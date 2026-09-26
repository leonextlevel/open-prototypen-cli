import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io';
import { SceneGraph } from '@open-pencil/scene-graph';
import {
  hexColor,
  pageBackground,
  readDesignSystem,
  sameTokenValue,
  tokenValue,
} from '../../core/src/system.js';
import { evalDocument, figPath, inspectCanvas } from './index.js';

export const SYSTEM_COLLECTION = 'Open Prototypen';
// OpenPencil keeps internal masters on this hidden page; they are not project work.
export const INTERNAL_PAGE = 'Internal Only Canvas';
export type NativeVariable = {
  id: string;
  name: string;
  type: string;
  collectionId: string;
  value: unknown;
};
export type NativeNode = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  componentId: string | null;
  boundVariables: Record<string, string>;
  // Present only on TEXT nodes.
  text?: string;
};
export type NativeSystem = {
  document: string;
  collections: { id: string; name: string; defaultModeId: string }[];
  variables: NativeVariable[];
  nodes: NativeNode[];
  // Project pages with their background as #RRGGBB, excluding the internal page.
  pages: { id: string; name: string; background: string | null }[];
};

async function createBlankDocument(file: string): Promise<void> {
  const graph = new SceneGraph();
  const io = new IORegistry(BUILTIN_IO_FORMATS);
  const result = await io.writeDocument('fig', graph);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, result.data as Uint8Array);
}

export function inspectNativeSystem(project: string): NativeSystem {
  const data = evalDocument(
    project,
    `
    return {
      collections: figma.getLocalVariableCollections().map((collection) => ({
        id: collection.id, name: collection.name, defaultModeId: collection.defaultModeId
      })),
      variables: figma.getLocalVariables().map((variable) => ({
        id: variable.id, name: variable.name, type: variable.type,
        collectionId: variable.collectionId,
        value: figma.graph.resolveVariable(variable.id)
      })),
      nodes: [...figma.graph.getAllNodes()].map((node) => ({
        id: node.id, name: node.name, type: node.type,
        parentId: node.parentId, componentId: node.componentId,
        boundVariables: node.boundVariables,
        text: node.type === 'TEXT' ? node.text : undefined
      })),
      pages: figma.root.children.map((page) => ({
        id: page.id, name: page.name, background: page.backgrounds[0]?.color ?? null
      }))
    };`,
  ) as Omit<NativeSystem, 'document' | 'pages'> & {
    pages: {
      id: string;
      name: string;
      background: { r: number; g: number; b: number } | null;
    }[];
  };
  return {
    document: figPath(project),
    ...data,
    pages: data.pages
      .filter((page) => page.name !== INTERNAL_PAGE)
      .map((page) => ({
        ...page,
        background: page.background ? hexColor(page.background) : null,
      })),
  };
}

// Deleting a bound variable unbinds its nodes and leaves their literal values behind.
export async function applyDesignSystem(
  project: string,
  options: { prune?: boolean; force?: boolean } = {},
): Promise<{
  document: string;
  created: string[];
  updated: string[];
  unchanged: string[];
  // Variables in the collection that system.yaml does not declare.
  extra: string[];
  pruned: string[];
  pageBackground: string;
  // Pages whose background was changed to pageBackground.
  pages: string[];
}> {
  const system = readDesignSystem(project);
  const file = figPath(project);
  if (!existsSync(file)) await createBlankDocument(file);
  const before = inspectNativeSystem(project);
  const collection = before.collections.find(
    (item) => item.name === SYSTEM_COLLECTION,
  );
  const known = before.variables.filter(
    (item) => item.collectionId === collection?.id,
  );
  const created: string[] = [],
    updated: string[] = [],
    unchanged: string[] = [];
  const values = system.tokens.map((token) => ({
    name: token.name,
    type: token.type,
    value: tokenValue(token),
  }));
  for (const token of values) {
    const existing = known.find((item) => item.name === token.name);
    if (!existing) created.push(token.name);
    else if (existing.type !== token.type)
      throw new Error(
        `Native variable ${token.name} has type ${existing.type}; expected ${token.type}`,
      );
    else if (!sameTokenValue(existing.value, token.value))
      updated.push(token.name);
    else unchanged.push(token.name);
  }
  const declared = new Set(values.map((token) => token.name));
  const extras = known.filter((item) => !declared.has(item.name));
  const pruned = options.prune ? extras : [];
  if (pruned.length && !options.force) {
    const bound = pruned
      .map((variable) => ({
        name: variable.name,
        nodes: before.nodes.filter((node) =>
          Object.values(node.boundVariables ?? {}).includes(variable.id),
        ).length,
      }))
      .filter((variable) => variable.nodes > 0);
    if (bound.length)
      throw new Error(
        `Cannot prune bound variables: ${bound.map((variable) => `${variable.name} (${variable.nodes} nodes)`).join(', ')}. Rebind those nodes to declared tokens, or pass --force to unbind them and keep their literal values.`,
      );
  }
  if (created.length || updated.length || !collection) {
    evalDocument(
      project,
      `
      const tokens = ${JSON.stringify(values)};
      const name = ${JSON.stringify(SYSTEM_COLLECTION)};
      const graph = figma.graph;
      const used = new Set([
        ...graph.nodes.keys(), ...graph.variables.keys(), ...graph.variableCollections.keys(),
        ...[...graph.variableCollections.values()].flatMap((item) => item.modes.map((mode) => mode.modeId))
      ]);
      let next = Math.max(0, ...[...used].map((id) => /^0:(\\d+)$/.exec(id)?.[1]).filter(Boolean).map(Number)) + 1;
      const uniqueId = () => {
        while (used.has('0:' + next)) next++;
        const id = '0:' + next++;
        used.add(id);
        return id;
      };
      let collection = figma.getLocalVariableCollections().find((item) => item.name === name);
      if (!collection) {
        const id = uniqueId(), modeId = uniqueId();
        collection = { id, name, modes: [{ modeId, name: 'Mode 1' }], defaultModeId: modeId, variableIds: [] };
        graph.addCollection(collection);
      }
      for (const token of tokens) {
        const current = figma.getLocalVariables().find((item) =>
          item.collectionId === collection.id && item.name === token.name);
        if (current) figma.setVariableValue(current.id, collection.defaultModeId, token.value);
        else {
          graph.addVariable({
            id: uniqueId(), name: token.name, type: token.type, collectionId: collection.id,
            valuesByMode: Object.fromEntries(collection.modes.map((mode) => [mode.modeId, structuredClone(token.value)])),
            description: '', hiddenFromPublishing: false
          });
        }
      }
      return { collection: collection.id, tokens: tokens.length };`,
      true,
    );
  }
  if (pruned.length)
    evalDocument(
      project,
      `
      const ids = new Set(${JSON.stringify(pruned.map((variable) => variable.id))});
      const graph = figma.graph;
      // The .fig writer also keeps each node's bindings in plugin data and rewrites it only
      // while a binding remains, so drop that copy along with the binding.
      for (const node of graph.getAllNodes()) {
        const bindings = Object.entries(node.boundVariables ?? {});
        if (!bindings.some(([, id]) => ids.has(id))) continue;
        graph.updateNode(node.id, {
          boundVariables: Object.fromEntries(bindings.filter(([, id]) => !ids.has(id))),
          pluginData: node.pluginData.filter((entry) => !(entry.pluginId === 'open-pencil' && entry.key === 'boundVariables')),
        });
      }
      for (const id of ids) graph.removeVariable(id);
      return ids.size;`,
      true,
    );
  const background = pageBackground(system);
  const pages = before.pages.filter((page) => page.background !== background);
  if (pages.length)
    evalDocument(
      project,
      `
      const ids = new Set(${JSON.stringify(pages.map((page) => page.id))});
      const color = ${JSON.stringify(tokenValue({ name: 'pageBackground', type: 'COLOR', value: background }))};
      for (const page of figma.root.children)
        if (ids.has(page.id))
          page.backgrounds = [{ type: 'SOLID', color, opacity: 1, visible: true, blendMode: 'NORMAL' }];
      return ids.size;`,
      true,
    );
  return {
    document: file,
    created,
    updated,
    unchanged,
    extra: extras.map((variable) => variable.name),
    pruned: pruned.map((variable) => variable.name),
    pageBackground: background,
    pages: pages.map((page) => page.name),
  };
}

export function importSvg(
  project: string,
  svgPath: string,
  name?: string,
): {
  document: string;
  id: string;
  name: string;
  type: string;
} {
  const file = resolve(svgPath);
  if (extname(file).toLowerCase() !== '.svg')
    throw new Error('Expected an .svg file');
  const svg = readFileSync(file, 'utf8');
  if (!/<svg\b/i.test(svg) || !/<\/svg\s*>/i.test(svg))
    throw new Error('Invalid SVG document');
  if (
    /<(?:script|foreignObject)\b/i.test(svg) ||
    /(?:href|xlink:href)\s*=\s*["'](?:https?:|data:|javascript:)/i.test(svg)
  )
    throw new Error('SVG contains unsupported active or external content');
  const importedName =
    name ??
    file
      .split('/')
      .at(-1)
      ?.replace(/\.svg$/i, '') ??
    'SVG';
  if (
    inspectNativeSystem(project).nodes.some(
      (node) => node.name === importedName,
    )
  )
    throw new Error(
      `A node named ${importedName} already exists; pass a unique --name`,
    );
  const result = evalDocument(
    project,
    `
    const { importSVG } = await import('@open-pencil/core/tools');
    return await importSVG.execute(figma, {
      svg: ${JSON.stringify(svg)}, name: ${JSON.stringify(importedName)}
    });`,
    true,
  ) as { id?: string; name?: string; type?: string; error?: string };
  if (result.error || !result.id || !result.name || !result.type)
    throw new Error(result.error ?? 'OpenPencil could not import SVG');
  const imported = inspectCanvas(project).tree.find(
    (node) => node.name === importedName,
  );
  if (!imported)
    throw new Error(`Imported SVG ${importedName} was not found after saving`);
  return {
    document: figPath(project),
    id: imported.id,
    name: imported.name,
    type: imported.type,
  };
}
