import { loadConfig } from '../../core/src/index.js';
import {
  readDesignSystem,
  sameTokenValue,
  systemPath,
  tokenValue,
} from '../../core/src/system.js';
import { figPath } from '../../openpencil/src/index.js';
import {
  inspectNativeSystem,
  SYSTEM_COLLECTION,
  type NativeNode,
} from '../../openpencil/src/system.js';

export type CanvasFinding = { code: string; message: string };
export type CanvasValidation = {
  artifact: 'canvas';
  valid: boolean;
  findings: CanvasFinding[];
  // Warnings describe likely drift but do not block compilation.
  warnings: CanvasFinding[];
  summary: {
    tokens: number;
    boundTokens: number;
    components: number;
    instances: number;
  };
};

function descendsFrom(
  node: NativeNode,
  ancestor: string,
  nodes: Map<string, NativeNode>,
): boolean {
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    if (parentId === ancestor) return true;
    seen.add(parentId);
    parentId = nodes.get(parentId)?.parentId ?? null;
  }
  return false;
}

export const DESIGN_SYSTEM_PAGE = 'Design System';
// OpenPencil keeps internal masters on this hidden page; they are not project work.
const INTERNAL_PAGE = 'Internal Only Canvas';

function pageOf(
  node: NativeNode,
  nodes: Map<string, NativeNode>,
): NativeNode | undefined {
  const seen = new Set<string>();
  for (
    let current: NativeNode | undefined = node;
    current && !seen.has(current.id);
    current = current.parentId ? nodes.get(current.parentId) : undefined
  ) {
    if (current.type === 'CANVAS') return current;
    seen.add(current.id);
  }
  return undefined;
}

function masterPageWarnings(
  components: NativeNode[],
  nodes: Map<string, NativeNode>,
): CanvasFinding[] {
  const masters = components
    .map((node) => ({ node, page: pageOf(node, nodes) }))
    .filter(({ page }) => page?.name !== INTERNAL_PAGE);
  if (!masters.length) return [];
  if (
    ![...nodes.values()].some(
      (node) => node.type === 'CANVAS' && node.name === DESIGN_SYSTEM_PAGE,
    )
  )
    return [
      {
        code: 'design-system-page',
        message: `No page named ${DESIGN_SYSTEM_PAGE}; place component masters and token samples there`,
      },
    ];
  return masters
    .filter(({ page }) => page?.name !== DESIGN_SYSTEM_PAGE)
    .map(({ node, page }) => ({
      code: 'component-page',
      message: `Component master ${node.name} is on page ${page?.name ?? 'unknown'} instead of ${DESIGN_SYSTEM_PAGE}`,
    }));
}

export function validateCanvas(
  project: string,
  screenFrames: Record<string, string>,
): CanvasValidation {
  loadConfig(project);
  const findings: CanvasFinding[] = [];
  const summary = { tokens: 0, boundTokens: 0, components: 0, instances: 0 };
  let system: ReturnType<typeof readDesignSystem>;
  try {
    system = readDesignSystem(project);
  } catch (error) {
    return {
      artifact: 'canvas',
      valid: false,
      warnings: [],
      findings: [
        {
          code: 'system-manifest',
          message: `${systemPath(project)}: ${String(error)}`,
        },
      ],
      summary,
    };
  }
  let native: ReturnType<typeof inspectNativeSystem>;
  try {
    native = inspectNativeSystem(project);
  } catch (error) {
    return {
      artifact: 'canvas',
      valid: false,
      warnings: [],
      findings: [
        { code: 'fig', message: `${figPath(project)}: ${String(error)}` },
      ],
      summary,
    };
  }
  const collection = native.collections.find(
    (item) => item.name === SYSTEM_COLLECTION,
  );
  if (!collection)
    findings.push({
      code: 'collection',
      message: `Missing native variable collection: ${SYSTEM_COLLECTION}`,
    });
  const variables = native.variables.filter(
    (item) => item.collectionId === collection?.id,
  );
  summary.tokens = variables.length;
  const boundIds = new Set(
    native.nodes.flatMap((node) => Object.values(node.boundVariables ?? {})),
  );
  summary.boundTokens = variables.filter((variable) =>
    boundIds.has(variable.id),
  ).length;
  for (const token of system.tokens) {
    const matches = variables.filter((item) => item.name === token.name);
    if (matches.length !== 1) {
      findings.push({
        code: 'token',
        message: `Expected one native variable named ${token.name}; found ${matches.length}`,
      });
      continue;
    }
    const variable = matches[0];
    if (!variable) continue;
    if (
      variable.type !== token.type ||
      !sameTokenValue(variable.value, tokenValue(token))
    )
      findings.push({
        code: 'token-value',
        message: `Native variable differs from manifest: ${token.name}`,
      });
    if (!boundIds.has(variable.id))
      findings.push({
        code: 'token-unbound',
        message: `Native variable is not bound to a node: ${token.name}`,
      });
  }
  const nodes = new Map(native.nodes.map((node) => [node.id, node]));
  const components = native.nodes.filter((node) => node.type === 'COMPONENT');
  const instances = native.nodes.filter((node) => node.type === 'INSTANCE');
  summary.components = components.length;
  summary.instances = instances.length;
  for (const entry of system.components) {
    const stateIds = new Set<string>();
    for (const state of entry.states) {
      const name = `${entry.name}/${state}`;
      const matches = components.filter((node) => node.name === name);
      if (matches.length !== 1)
        findings.push({
          code: 'component-state',
          message: `Expected one native component named ${name}; found ${matches.length}`,
        });
      if (matches.length === 1 && matches[0]) stateIds.add(matches[0].id);
    }
    for (const screen of entry.screens) {
      const frameId = screenFrames[screen];
      if (!frameId) {
        findings.push({
          code: 'component-screen',
          message: `Unknown screen ${screen} for component ${entry.name}`,
        });
        continue;
      }
      if (!nodes.has(frameId)) {
        findings.push({
          code: 'component-screen',
          message: `Screen ${screen} frame ${frameId} is missing`,
        });
        continue;
      }
      if (
        !instances.some(
          (node) =>
            node.componentId &&
            stateIds.has(node.componentId) &&
            descendsFrom(node, frameId, nodes),
        )
      )
        findings.push({
          code: 'component-instance',
          message: `No linked ${entry.name} instance in screen ${screen}`,
        });
    }
  }
  if (
    !instances.some(
      (node) =>
        node.componentId &&
        components.some((component) => component.id === node.componentId),
    )
  )
    findings.push({
      code: 'instance',
      message: 'No linked native component instance found',
    });
  return {
    artifact: 'canvas',
    valid: findings.length === 0,
    findings,
    warnings: masterPageWarnings(components, nodes),
    summary,
  };
}
