import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io';
import { SceneGraph } from '@open-pencil/scene-graph';
import {
  readDesignSystem,
  sameTokenValue,
  tokenValue,
} from '../../core/src/system.js';
import { evalDocument, figPath, inspectCanvas } from './index.js';

export const SYSTEM_COLLECTION = 'Open Prototypen';
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
      }))
    };`,
  ) as Omit<NativeSystem, 'document'>;
  return { document: figPath(project), ...data };
}

export async function applyDesignSystem(project: string): Promise<{
  document: string;
  created: string[];
  updated: string[];
  unchanged: string[];
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
  return { document: file, created, updated, unchanged };
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
