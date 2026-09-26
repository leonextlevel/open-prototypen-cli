import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io';
import { SceneGraph } from '@open-pencil/scene-graph';
import {
  contrastWarnings,
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
  // Present only on frames, components, instances, and rectangles.
  layoutMode?: string;
  itemSpacing?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
  radius?: {
    topLeft: number;
    topRight: number;
    bottomRight: number;
    bottomLeft: number;
  };
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
        text: node.type === 'TEXT' ? node.text : undefined,
        ...(['FRAME', 'COMPONENT', 'INSTANCE', 'RECTANGLE'].includes(node.type) ? {
          layoutMode: node.layoutMode, itemSpacing: node.itemSpacing,
          padding: { top: node.paddingTop, right: node.paddingRight, bottom: node.paddingBottom, left: node.paddingLeft },
          radius: node.independentCorners
            ? { topLeft: node.topLeftRadius, topRight: node.topRightRadius, bottomRight: node.bottomRightRadius, bottomLeft: node.bottomLeftRadius }
            : { topLeft: node.cornerRadius, topRight: node.cornerRadius, bottomRight: node.cornerRadius, bottomLeft: node.cornerRadius }
        } : {})
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
  // Declared color pairs below their WCAG threshold.
  contrast: { code: string; message: string }[];
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
    contrast: contrastWarnings(system),
  };
}

// Gap between an automatically placed import and the page's existing content or the previous import.
const IMPORT_GAP = 32;
type ImportOptions = { page?: string; x?: number; y?: number };
type ImportedNode = {
  id: string;
  name: string;
  type: string;
  page: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
// One imported copy of the SVG: its node name, an optional size for its longer side, whether it
// becomes a master, and an optional COLOR variable bound to its vector paints.
type ImportItem = {
  name: string;
  size?: number;
  component: boolean;
  variable?: {
    id: string;
    color: { r: number; g: number; b: number; a: number };
  };
};

function readSvg(svgPath: string): { file: string; svg: string } {
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
  return { file, svg };
}

function importItems(
  project: string,
  svg: string,
  items: ImportItem[],
  options: ImportOptions,
): ImportedNode[] {
  const existing = new Set(
    inspectNativeSystem(project).nodes.map((node) => node.name),
  );
  for (const item of items)
    if (existing.has(item.name))
      throw new Error(
        `A node named ${item.name} already exists; pass a unique --name`,
      );
  const result = evalDocument(
    project,
    `
    const { importSVG } = await import('@open-pencil/core/tools');
    const pageName = ${JSON.stringify(options.page ?? null)};
    const page = pageName === null
      ? figma.currentPage
      : figma.root.children.find((item) => item.name === pageName);
    if (!page) return { error: 'Unknown page: ' + pageName };
    // Without coordinates, place the import to the right of the page's content so imports never stack.
    const content = page.children;
    let x = ${JSON.stringify(options.x ?? null)}, y = ${JSON.stringify(options.y ?? null)};
    if (x === null)
      x = content.length ? Math.max(...content.map((node) => node.x + node.width)) + ${IMPORT_GAP} : 0;
    if (y === null) y = content.length ? Math.min(...content.map((node) => node.y)) : 0;
    const graph = figma.graph;
    const descendants = (id) => {
      const node = graph.getNode(id);
      return node ? [node, ...node.childIds.flatMap(descendants)] : [];
    };
    const containers = new Set(['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE']);
    for (const item of ${JSON.stringify(items)}) {
      const imported = await importSVG.execute(figma, {
        svg: ${JSON.stringify(svg)}, name: item.name, parent_id: page.id, x, y
      });
      if (!imported?.id) return { error: imported?.error ?? 'OpenPencil could not import SVG' };
      let node = figma.getNodeById(imported.id);
      if (item.size) node.rescale(item.size / Math.max(node.width, node.height));
      if (item.component) node = figma.createComponentFromNode(node);
      for (const child of descendants(node.id)) {
        // OpenPencil maps stroke-linecap and stroke-linejoin onto each stroke, but saves only the
        // node-level strokeCap and strokeJoin, so copy them there before saving.
        const stroke = child.strokes?.[0];
        if (child.type === 'VECTOR' && stroke && (stroke.cap || stroke.join))
          graph.updateNode(child.id, {
            ...(stroke.cap ? { strokeCap: stroke.cap } : {}),
            ...(stroke.join ? { strokeJoin: stroke.join } : {}),
          });
        if (!item.variable || containers.has(child.type)) continue;
        // Binding does not repaint a literal, so write the token color before binding it.
        for (const field of ['fills', 'strokes']) {
          const paint = child[field]?.[0];
          // Strokes carry a color without a paint type; fills are typed paints.
          if (!paint?.color || paint.visible === false) continue;
          if (field === 'fills' && paint.type !== 'SOLID') continue;
          graph.updateNode(child.id, {
            [field]: child[field].map((entry, index) =>
              index === 0 ? { ...entry, color: item.variable.color } : entry),
          });
          figma.bindVariable(child.id, field + '/0/color', item.variable.id);
        }
      }
      x += node.width + ${IMPORT_GAP};
    }
    return { page: page.name };`,
    true,
  ) as { page?: string; error?: string };
  if (result.error || !result.page)
    throw new Error(result.error ?? 'OpenPencil could not import SVG');
  const tree = inspectCanvas(project).tree;
  return items.map((item) => {
    const node = tree.find(
      (entry) => entry.name === item.name && entry.page === result.page,
    );
    if (!node)
      throw new Error(`Imported SVG ${item.name} was not found after saving`);
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      page: result.page ?? '',
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
  });
}

export function importSvg(
  project: string,
  svgPath: string,
  name?: string,
  options: ImportOptions & { component?: boolean } = {},
): { document: string } & ImportedNode {
  const { file, svg } = readSvg(svgPath);
  const importedName =
    name ??
    file
      .split('/')
      .at(-1)
      ?.replace(/\.svg$/i, '') ??
    'SVG';
  const [imported] = importItems(
    project,
    svg,
    [{ name: importedName, component: Boolean(options.component) }],
    options,
  );
  return { document: figPath(project), ...(imported as ImportedNode) };
}

// Parses `16:color/icon/muted,24:color/accent` into sizes and COLOR token names.
export function parseVariants(
  value: string,
): { size: number; token: string }[] {
  return value.split(',').map((entry) => {
    const match = /^\s*(\d+(?:\.\d+)?)\s*:\s*(\S+)\s*$/.exec(entry);
    const size = Number(match?.[1]);
    if (!match?.[2] || !(size > 0))
      throw new Error(
        `Invalid variant ${entry.trim()}; expected <size>:<color token>, such as 16:color/icon/muted`,
      );
    return { size, token: match[2] };
  });
}

// Creates one master per variant, named <name>/<size>-<last token segment>, rescaled so its longer
// side is the size, with its vector fills and strokes bound to the COLOR token.
export function importSvgVariants(
  project: string,
  svgPath: string,
  name: string,
  variants: { size: number; token: string }[],
  options: ImportOptions = {},
): { document: string; page: string; masters: ImportedNode[] } {
  const { svg } = readSvg(svgPath);
  const system = readDesignSystem(project);
  const native = inspectNativeSystem(project);
  const collection = native.collections.find(
    (item) => item.name === SYSTEM_COLLECTION,
  );
  const items = variants.map(({ size, token }) => {
    const declared = system.tokens.find((entry) => entry.name === token);
    if (!declared) throw new Error(`Unknown token: ${token}`);
    if (declared.type !== 'COLOR')
      throw new Error(`Token ${token} is ${declared.type}, not a COLOR`);
    const variable = native.variables.find(
      (entry) => entry.name === token && entry.collectionId === collection?.id,
    );
    if (!variable)
      throw new Error(
        `Native variable ${token} does not exist; run open-prototypen system apply`,
      );
    const suffix = token.split(/[/.]/).at(-1) ?? token;
    const color = tokenValue(declared);
    if (typeof color !== 'object') throw new Error(`Invalid color ${token}`);
    return {
      name: `${name}/${size}-${suffix}`,
      size,
      component: true,
      variable: { id: variable.id, color },
    };
  });
  const names = items.map((item) => item.name);
  const duplicate = names.find((item, index) => names.indexOf(item) !== index);
  if (duplicate)
    throw new Error(`Two variants would both be named ${duplicate}`);
  const masters = importItems(project, svg, items, options);
  return {
    document: figPath(project),
    page: masters[0]?.page ?? '',
    masters,
  };
}

type Rgba = { r: number; g: number; b: number; a: number };
export type TextContrastSample = {
  root: string;
  name: string;
  text: string;
} & (
  | {
      foreground: Rgba;
      background: Rgba;
      fontSize: number;
      fontWeight: number;
    }
  | { unchecked: string }
);
// Reads, in one pass, the color each visible text node renders in and the solid background behind
// it, within the given roots. Bound fills render with their variable's value. The background is the
// nearest opaque layer, found among earlier siblings that fully cover the text box and ancestors'
// fills, with translucent layers above it composited. Stacks the check cannot trust, such as
// gradients, images, partial overlaps, or translucent groups, are returned as unchecked; a root
// without an opaque background is unchecked unless `skipOpen` lists it.
export function textContrastSamples(
  project: string,
  roots: string[],
  skipOpen: string[] = [],
): TextContrastSample[] {
  return evalDocument(
    project,
    `
    const graph = figma.graph;
    const roots = new Set(${JSON.stringify(roots)});
    const skipOpen = new Set(${JSON.stringify(skipOpen)});
    const node = (id) => graph.getNode(id);
    // Visible paint layers of a node, from top to bottom, or null when one is not a solid color.
    const layers = (owner, field) => {
      const result = [];
      const paints = owner[field] ?? [];
      for (let index = paints.length - 1; index >= 0; index--) {
        const paint = paints[index];
        if (paint.visible === false) continue;
        if (field === 'fills' && paint.type !== 'SOLID') return null;
        const bound = owner.boundVariables?.[field + '/' + index + '/color'];
        const color = bound ? graph.resolveVariable(bound) : paint.color;
        if (!color || typeof color !== 'object') return null;
        result.push({ r: color.r, g: color.g, b: color.b, a: (color.a ?? 1) * (paint.opacity ?? 1) * (owner.opacity ?? 1) });
      }
      return result;
    };
    const absolute = (id) => {
      let x = 0, y = 0;
      for (let current = node(id); current && current.type !== 'CANVAS'; current = node(current.parentId)) {
        x += current.x; y += current.y;
      }
      return { x, y };
    };
    const rect = (current) => ({ ...absolute(current.id), width: current.width, height: current.height });
    const covers = (outer, inner) =>
      outer.x <= inner.x && outer.y <= inner.y &&
      outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;
    const overlaps = (a, b) =>
      a.x < b.x + Math.max(b.width, 1) && b.x < a.x + a.width && a.y < b.y + Math.max(b.height, 1) && b.y < a.y + a.height;
    const blend = (top, bottom) => ({
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a),
      a: 1,
    });
    const sample = (text, root) => {
      const base = { root, name: text.name, text: (text.text ?? '').trim().slice(0, 40) };
      const own = layers(text, 'fills');
      if (!own || own.length !== 1) return { ...base, unchecked: 'text fill is not a single solid color' };
      // Headless OpenPencil does not measure text, so its default 100×100 box only locates its origin.
      const measured = !(text.width === 100 && text.height === 100);
      const position = rect(text);
      const box = measured ? position : { ...position, width: 0, height: 0 };
      const found = [];
      let child = text;
      for (;;) {
        const parent = node(child.parentId);
        if (!parent || parent.type === 'CANVAS') break;
        if ((parent.opacity ?? 1) < 1 && !roots.has(parent.id))
          return { ...base, unchecked: 'a translucent group contains the text' };
        const siblings = parent.childIds.slice(0, parent.childIds.indexOf(child.id)).reverse();
        for (const id of siblings) {
          const sibling = node(id);
          if (!sibling || sibling.visible === false) continue;
          const area = rect(sibling);
          if (!overlaps(area, box)) continue;
          if (!covers(area, box) || sibling.childIds.length || !['RECTANGLE', 'FRAME'].includes(sibling.type))
            return { ...base, unchecked: 'the text overlaps a shape or group that does not simply cover it' };
          const paints = layers(sibling, 'fills');
          if (!paints) return { ...base, unchecked: 'the background is not a solid color' };
          found.push(...paints);
          if (found.some((layer) => layer.a >= 0.999)) break;
        }
        if (found.some((layer) => layer.a >= 0.999)) break;
        const paints = layers(parent, 'fills');
        if (!paints) return { ...base, unchecked: 'the background is not a solid color' };
        found.push(...paints);
        if (found.some((layer) => layer.a >= 0.999) || roots.has(parent.id)) break;
        child = parent;
      }
      const bottom = found.findIndex((layer) => layer.a >= 0.999);
      if (bottom < 0) return skipOpen.has(root) ? null : { ...base, unchecked: 'no opaque background behind the text' };
      let background = { ...found[bottom], a: 1 };
      for (let index = bottom - 1; index >= 0; index--) background = blend(found[index], background);
      return {
        ...base,
        foreground: blend(own[0], background),
        background,
        fontSize: text.fontSize ?? 0,
        fontWeight: text.fontWeight ?? 400,
      };
    };
    const samples = [];
    const visit = (id, root) => {
      const current = node(id);
      if (!current || current.visible === false) return;
      if (current.type === 'TEXT') {
        const result = sample(current, root);
        if (result) samples.push(result);
      }
      for (const child of current.childIds ?? []) visit(child, root);
    };
    for (const root of roots) visit(root, root);
    return samples;`,
  ) as TextContrastSample[];
}
