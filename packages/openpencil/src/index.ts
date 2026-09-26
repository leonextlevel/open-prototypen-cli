import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { workspace } from '../../core/src/index.js';

export type DesignNode = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ref?: string;
  page?: string;
  children?: DesignNode[];
};
export type Bounds = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };
// Shared plugin data survives saves, unlike node IDs, which OpenPencil renumbers in document order.
export const REF_NAMESPACE = 'open-prototypen';
export const REF_KEY = 'ref';
export function figPath(project: string): string {
  return join(workspace(project), 'prototype/prototype.fig');
}
function run(args: string[], input?: string): string {
  const library = createRequire(import.meta.url).resolve(
    '@open-pencil/cli/library',
  );
  const binary = join(dirname(dirname(dirname(library))), 'bin/openpencil.js');
  return execFileSync(process.execPath, [binary, ...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 20 * 1024 * 1024,
  });
}
export function evalDocument(
  project: string,
  code: string,
  write = false,
): unknown {
  const file = figPath(project);
  if (!existsSync(file))
    throw new Error(`OpenPencil document does not exist: ${file}`);
  return evalFile(file, code, write);
}
function evalFile(file: string, code: string, write = false): unknown {
  const result = run(
    ['eval', file, '--stdin', '--json', ...(write ? ['--write'] : [])],
    code,
  );
  return result.trim() ? JSON.parse(result) : undefined;
}
export function inspectCanvas(project: string): {
  document: string;
  pages: unknown;
  tree: DesignNode[];
} {
  const file = figPath(project);
  if (!existsSync(file))
    throw new Error(`OpenPencil document does not exist: ${file}`);
  const tree = evalDocument(
    project,
    `
    const graph = figma.graph;
    const visit = (id) => {
      const node = graph.getNode(id);
      if (!node) return null;
      const result = {
        id: node.id, name: node.name, type: node.type,
        x: Math.round(node.x), y: Math.round(node.y),
        width: Math.round(node.width), height: Math.round(node.height)
      };
      const ref = figma.getNodeById(id)?.getSharedPluginData(${JSON.stringify(REF_NAMESPACE)}, ${JSON.stringify(REF_KEY)});
      if (ref) result.ref = ref;
      if (node.childIds.length) {
        result.children = node.childIds.map(visit).filter(Boolean);
      }
      return result;
    };
    return graph.getPages().flatMap((page) =>
      page.childIds.map(visit).filter(Boolean).map((node) => ({ ...node, page: page.name })));`,
  ) as DesignNode[];
  return {
    document: file,
    pages: JSON.parse(run(['pages', file, '--json'])),
    tree,
  };
}
export function findNode(
  tree: DesignNode[],
  id: string,
): { node: DesignNode; bounds: Bounds } | undefined {
  function visit(
    nodes: DesignNode[],
    x: number,
    y: number,
  ): { node: DesignNode; bounds: Bounds } | undefined {
    for (const node of nodes) {
      const bounds = {
        x: x + node.x,
        y: y + node.y,
        width: node.width,
        height: node.height,
      };
      if (node.id === id) return { node, bounds };
      const found = visit(node.children ?? [], bounds.x, bounds.y);
      if (found) return found;
    }
    return undefined;
  }
  return visit(tree, 0, 0);
}
export function relativeBounds(
  tree: DesignNode[],
  frameId: string,
  actionId: string,
): Bounds {
  const frame = findNode(tree, frameId),
    action = findNode(tree, actionId);
  if (!frame) throw new Error(`Unknown frame node: ${frameId}`);
  if (!action) throw new Error(`Unknown action node: ${actionId}`);
  const descendant = (nodes: DesignNode[]): boolean =>
    nodes.some(
      (node) => node.id === actionId || descendant(node.children ?? []),
    );
  if (!descendant(frame.node.children ?? []))
    throw new Error(`Action node ${actionId} is not inside frame ${frameId}`);
  const bounds = {
    x: action.bounds.x - frame.bounds.x,
    y: action.bounds.y - frame.bounds.y,
    width: action.bounds.width,
    height: action.bounds.height,
  };
  if (bounds.width <= 0 || bounds.height <= 0)
    throw new Error(`Action node ${actionId} has empty bounds`);
  return bounds;
}
export function pngSize(file: string): Size {
  const data = readFileSync(file);
  if (data.length < 24 || data.toString('ascii', 12, 16) !== 'IHDR')
    throw new Error(`Not a PNG image: ${file}`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}
export function sameSize(actual: Size, expected: Size): boolean {
  // Fractional frame sizes may round either way in the exported PNG.
  return (
    Math.abs(actual.width - expected.width) <= 1 &&
    Math.abs(actual.height - expected.height) <= 1
  );
}
export function renderFrame(
  project: string,
  frameId: string,
  output: string,
  expected?: Size,
): string {
  const file = figPath(project);
  if (!existsSync(file))
    throw new Error(`OpenPencil document does not exist: ${file}`);
  mkdirSync(dirname(output), { recursive: true });
  // Export beside the target so a failed check never replaces a good render.
  const temporary = join(
    dirname(output),
    `.${basename(output, '.png')}.${process.pid}.tmp.png`,
  );
  try {
    run(['export', file, '-f', 'png', '--node', frameId, '-o', temporary]);
    if (!existsSync(temporary))
      throw new Error(`OpenPencil did not produce ${output}`);
    if (expected) {
      const actual = pngSize(temporary);
      if (!sameSize(actual, expected))
        throw new Error(
          `Render of frame ${frameId} is ${actual.width}×${actual.height} but the frame is ${expected.width}×${expected.height}; content outside the frame is being exported. Enable clipsContent on the frame or keep its content inside the frame bounds.`,
        );
    }
    renameSync(temporary, output);
  } finally {
    rmSync(temporary, { force: true });
  }
  return output;
}
// OpenPencil exports pages with a transparent background and ignores page fills, so export from a
// temporary copy with an opaque rectangle behind the page content. The project file is untouched.
export function renderPage(
  project: string,
  page: string,
  output: string,
  background: { r: number; g: number; b: number },
): string {
  const file = figPath(project);
  if (!existsSync(file))
    throw new Error(`OpenPencil document does not exist: ${file}`);
  const directory = mkdtempSync(join(tmpdir(), 'open-prototypen-page-'));
  try {
    const copy = join(directory, 'page.fig');
    copyFileSync(file, copy);
    const result = evalFile(
      copy,
      `
      const page = figma.root.children.find((item) => item.name === ${JSON.stringify(page)});
      if (!page) return { error: 'missing' };
      const nodes = page.children;
      if (!nodes.length) return { error: 'empty' };
      const left = Math.min(...nodes.map((node) => node.x));
      const top = Math.min(...nodes.map((node) => node.y));
      const right = Math.max(...nodes.map((node) => node.x + node.width));
      const bottom = Math.max(...nodes.map((node) => node.y + node.height));
      figma.currentPage = page;
      const backdrop = figma.createRectangle();
      backdrop.name = 'open-prototypen background';
      backdrop.fills = [{ type: 'SOLID', color: { ...${JSON.stringify(background)}, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }];
      page.insertChild(0, backdrop);
      // A margin keeps content off the image edges.
      const margin = 32;
      backdrop.resize(right - left + 2 * margin, bottom - top + 2 * margin);
      backdrop.x = left - margin; backdrop.y = top - margin;
      return { pages: figma.root.children.map((item) => item.name) };`,
      true,
    ) as { error?: string; pages?: string[] };
    if (result.error === 'missing') throw new Error(`Unknown page: ${page}`);
    if (result.error === 'empty') throw new Error(`Page ${page} is empty`);
    mkdirSync(dirname(output), { recursive: true });
    const temporary = join(directory, 'page.png');
    run(['export', copy, '-f', 'png', '--page', page, '-o', temporary]);
    if (!existsSync(temporary))
      throw new Error(`OpenPencil did not produce ${output}`);
    copyFileSync(temporary, output);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  return output;
}
