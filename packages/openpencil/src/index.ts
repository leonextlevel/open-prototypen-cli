import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { workspace } from '../../core/src/index.js';

export type DesignNode = {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children?: DesignNode[];
};
export type Bounds = { x: number; y: number; width: number; height: number };
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
  return {
    document: file,
    pages: JSON.parse(run(['pages', file, '--json'])),
    tree: JSON.parse(run(['tree', file, '--json'])) as DesignNode[],
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
export function renderFrame(
  project: string,
  frameId: string,
  output: string,
): string {
  const file = figPath(project);
  if (!existsSync(file))
    throw new Error(`OpenPencil document does not exist: ${file}`);
  mkdirSync(join(output, '..'), { recursive: true });
  run(['export', file, '-f', 'png', '--node', frameId, '-o', output]);
  if (!existsSync(output))
    throw new Error(`OpenPencil did not produce ${output}`);
  return output;
}
