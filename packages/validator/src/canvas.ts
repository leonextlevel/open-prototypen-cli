import { loadConfig } from '../../core/src/index.js';
import {
  contrastRatio,
  contrastWarnings,
  hexColor,
  pageBackground,
  readDesignSystem,
  scaleValues,
  type DesignSystem,
  type DesignToken,
  sameTokenValue,
  systemPath,
  tokenValue,
} from '../../core/src/system.js';
import {
  figPath,
  fontWarning,
  missingFonts,
} from '../../openpencil/src/index.js';
import {
  INTERNAL_PAGE,
  inspectNativeSystem,
  SYSTEM_COLLECTION,
  textContrastSamples,
  type NativeNode,
  type NativeSystem,
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
    // Text nodes checked for contrast, and those whose background could not be determined.
    textContrast: { checked: number; unchecked: number };
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

// An instance nested in another master's instance links to the matching layer of that master,
// which is itself an instance; follow the chain to the component it ultimately uses.
function linkedMaster(
  node: NativeNode,
  nodes: Map<string, NativeNode>,
): string | undefined {
  const seen = new Set<string>();
  for (
    let id: string | null | undefined = node.componentId;
    id && !seen.has(id);
    id = nodes.get(id)?.componentId
  ) {
    const target = nodes.get(id);
    if (target?.type === 'COMPONENT') return id;
    if (target?.type !== 'INSTANCE') return undefined;
    seen.add(id);
  }
  return undefined;
}

export const DESIGN_SYSTEM_PAGE = 'Design System';

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

// The editor already labels every master with its name, so a loose text repeating it is noise.
function masterLabelWarnings(
  components: NativeNode[],
  nodes: Map<string, NativeNode>,
): CanvasFinding[] {
  const normalize = (value: string) =>
    value
      .trim()
      .replace(/\s*\/\s*/g, '/')
      .toLowerCase();
  const masters = new Set(components.map((node) => normalize(node.name)));
  return [...nodes.values()]
    .filter(
      (node) =>
        node.type === 'TEXT' &&
        node.text !== undefined &&
        masters.has(normalize(node.text)) &&
        pageOf(node, nodes)?.name === DESIGN_SYSTEM_PAGE &&
        !insideComponent(node, nodes),
    )
    .map((node) => ({
      code: 'master-label',
      message: `Text "${node.text?.trim()}" on ${DESIGN_SYSTEM_PAGE} repeats a component master's name, which the editor already shows; keep text for group headings and token samples`,
    }));
}

function insideMaster(
  node: NativeNode,
  nodes: Map<string, NativeNode>,
): boolean {
  const seen = new Set<string>();
  for (
    let id = node.parentId;
    id && !seen.has(id);
    id = nodes.get(id)?.parentId ?? null
  ) {
    if (nodes.get(id)?.type === 'COMPONENT') return true;
    seen.add(id);
  }
  return false;
}

function insideComponent(
  node: NativeNode,
  nodes: Map<string, NativeNode>,
): boolean {
  const seen = new Set<string>();
  for (
    let id = node.parentId;
    id && !seen.has(id);
    id = nodes.get(id)?.parentId ?? null
  ) {
    const type = nodes.get(id)?.type;
    if (type === 'COMPONENT' || type === 'INSTANCE') return true;
    seen.add(id);
  }
  return false;
}

// Unbound gaps, paddings, and corner radii in screens and masters that no declared scale contains,
// grouped by value so an intentional exception reads as one line.
function offScaleWarnings(
  system: DesignSystem,
  screenFrames: Record<string, string>,
  components: NativeNode[],
  nodes: Map<string, NativeNode>,
): CanvasFinding[] {
  const roots = new Set([
    ...Object.values(screenFrames),
    ...components
      .filter((node) => pageOf(node, nodes)?.name !== INTERNAL_PAGE)
      .map((node) => node.id),
  ]);
  const inScope = (node: NativeNode) =>
    roots.has(node.id) ||
    [...roots].some((root) => descendsFrom(node, root, nodes));
  const checks = [
    {
      scale: 'spacing' as const,
      code: 'off-scale-spacing',
      values: (node: NativeNode) =>
        node.layoutMode && node.layoutMode !== 'NONE' && node.padding
          ? [
              ['gap', 'itemSpacing', node.itemSpacing],
              ['padding', 'paddingTop', node.padding.top],
              ['padding', 'paddingRight', node.padding.right],
              ['padding', 'paddingBottom', node.padding.bottom],
              ['padding', 'paddingLeft', node.padding.left],
            ]
          : [],
    },
    {
      scale: 'radius' as const,
      code: 'off-scale-radius',
      values: (node: NativeNode) =>
        node.radius
          ? [
              ['radius', 'topLeftRadius', node.radius.topLeft],
              ['radius', 'topRightRadius', node.radius.topRight],
              ['radius', 'bottomRightRadius', node.radius.bottomRight],
              ['radius', 'bottomLeftRadius', node.radius.bottomLeft],
            ]
          : [],
    },
  ];
  const warnings: CanvasFinding[] = [];
  for (const check of checks) {
    const scale = scaleValues(system, check.scale);
    if (!scale) continue;
    const groups = new Map<string, Set<string>>();
    for (const node of nodes.values()) {
      if (!inScope(node)) continue;
      const bound = node.boundVariables ?? {};
      for (const [label, field, value] of check.values(node) as [
        string,
        string,
        number | undefined,
      ][]) {
        const radiusBound =
          field.endsWith('Radius') && bound.cornerRadius !== undefined;
        if (
          !value ||
          bound[field] !== undefined ||
          radiusBound ||
          scale.some((step) => Math.abs(step - value) < 0.01)
        )
          continue;
        const key = `${label} ${Math.round(value * 100) / 100}`;
        groups.set(key, (groups.get(key) ?? new Set()).add(node.name));
      }
    }
    for (const [key, names] of groups)
      warnings.push({
        code: check.code,
        message: `${key} is not in the ${check.scale} scale (${[...scale].sort((a, b) => a - b).join(', ')}) on ${names.size} ${names.size === 1 ? 'node' : 'nodes'}: ${[...names].slice(0, 5).join(', ')}${names.size > 5 ? ', …' : ''}. Bind a scale token, or accept it as an intentional adjustment`,
      });
  }
  return warnings;
}

// WCAG 2.2 treats text of at least 24 px, or 18.66 px when bold, as large.
function textContrastWarnings(
  project: string,
  screenFrames: Record<string, string>,
  components: NativeNode[],
  nodes: Map<string, NativeNode>,
  summary: CanvasValidation['summary'],
): CanvasFinding[] {
  const labels = new Map<string, string>();
  for (const [screen, id] of Object.entries(screenFrames))
    if (nodes.has(id))
      labels.set(
        id,
        labels.has(id) ? `${labels.get(id)}, ${screen}` : `Screen ${screen}`,
      );
  const masters = components.filter(
    (node) => pageOf(node, nodes)?.name !== INTERNAL_PAGE,
  );
  for (const master of masters) labels.set(master.id, `Master ${master.name}`);
  if (!labels.size) return [];
  // A master without its own background takes the screen's, which the screen check covers.
  const samples = textContrastSamples(
    project,
    [...labels.keys()],
    masters.map((master) => master.id),
  );
  const warnings: CanvasFinding[] = [];
  let unchecked = 0;
  for (const sample of samples) {
    if ('unchecked' in sample) {
      unchecked++;
      continue;
    }
    summary.textContrast.checked++;
    const large =
      sample.fontSize >= 24 ||
      (sample.fontSize >= 18.66 && sample.fontWeight >= 700);
    const required = large ? 3 : 4.5;
    const ratio = contrastRatio(sample.foreground, sample.background);
    if (ratio < required)
      warnings.push({
        code: 'text-contrast',
        message: `${labels.get(sample.root)}: text "${sample.text || sample.name}" is ${hexColor(sample.foreground)} on ${hexColor(sample.background)}, ${(Math.floor(ratio * 100) / 100).toFixed(2)}:1, below the ${required}:1 WCAG 2.2 requires for ${large ? 'large text' : 'text'}`,
      });
  }
  summary.textContrast.unchecked = unchecked;
  if (unchecked)
    warnings.push({
      code: 'text-contrast-unchecked',
      message: `${unchecked} text nodes were not checked for contrast because their background is not a plain solid color behind them (an image, gradient, translucent group, or partial overlap); review them in the renders`,
    });
  return warnings;
}

// Masters are named <component>/<state>; the component name may itself contain /.
function componentName(master: string): string {
  return master.split('/').slice(0, -1).join('/').trim();
}

// The inverse of the screen check: instances on screens their component does not declare, and
// masters without any linked instance, including instances inside other masters.
function componentUsageWarnings(
  screenBases: Record<string, string>,
  system: DesignSystem,
  screenFrames: Record<string, string>,
  components: NativeNode[],
  instances: NativeNode[],
  nodes: Map<string, NativeNode>,
): CanvasFinding[] {
  const warnings: CanvasFinding[] = [];
  const used = new Set(
    instances.flatMap((node) => linkedMaster(node, nodes) ?? []),
  );
  for (const [screen, frameId] of Object.entries(screenFrames)) {
    if (!nodes.has(frameId)) continue;
    const reported = new Set<string>();
    for (const node of instances) {
      const master = linkedMaster(node, nodes);
      if (!master || !descendsFrom(node, frameId, nodes)) continue;
      const name = componentName(nodes.get(master)?.name ?? '');
      const entry = system.components.find((item) => item.name === name);
      const base = screenBases[screen];
      if (
        !entry ||
        entry.screens.includes(screen) ||
        (base && entry.screens.includes(base)) ||
        reported.has(name)
      )
        continue;
      reported.add(name);
      warnings.push({
        code: 'component-screen-undeclared',
        message: `Component ${name} appears on screen ${screen}, which its screens in system.yaml do not list`,
      });
    }
  }
  const declared = new Set(
    system.components.flatMap((entry) =>
      entry.states.map((state) => `${entry.name}/${state}`),
    ),
  );
  for (const master of components) {
    if (pageOf(master, nodes)?.name === INTERNAL_PAGE) continue;
    if (!declared.has(master.name))
      warnings.push({
        code: 'component-undeclared',
        message: `Component master ${master.name} is not a <name>/<state> declared in system.yaml; declare it or remove the master`,
      });
    if (!used.has(master.id))
      warnings.push({
        code: 'component-unused',
        message: `Component master ${master.name} has no linked instance`,
      });
  }
  return warnings;
}

// Token samples carry labels such as `color.text  #111111`. The value is read from the text
// between a token's name and the next token name, so a label may describe several tokens.
function tokenLabelWarnings(
  tokens: DesignToken[],
  nodes: Map<string, NativeNode>,
): CanvasFinding[] {
  const escape = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // A name must not continue with characters that could extend it into another token name.
  const pattern = new RegExp(
    [...tokens]
      .sort((a, b) => b.name.length - a.name.length)
      .map((token) => `(?<![\\w./-])${escape(token.name)}(?![\\w/-]|\\.\\w)`)
      .join('|'),
    'g',
  );
  const byName = new Map(tokens.map((token) => [token.name, token]));
  const warnings: CanvasFinding[] = [];
  for (const node of nodes.values()) {
    if (
      node.type !== 'TEXT' ||
      !node.text ||
      pageOf(node, nodes)?.name !== DESIGN_SYSTEM_PAGE ||
      insideComponent(node, nodes)
    )
      continue;
    const matches = [...node.text.matchAll(pattern)];
    for (const [index, match] of matches.entries()) {
      const token = byName.get(match[0]);
      if (!token) continue;
      const end = matches[index + 1]?.index ?? node.text.length;
      const segment = node.text.slice(match.index + match[0].length, end);
      const shown = labelValue(token, segment);
      if (shown !== undefined)
        warnings.push({
          code: 'token-label',
          message: `Sample label for ${token.name} shows ${shown}; manifest is ${String(token.value)}. Update the label on ${DESIGN_SYSTEM_PAGE}.`,
        });
    }
  }
  return warnings;
}
// Returns the value a label shows when it differs from the token, or undefined.
function labelValue(token: DesignToken, segment: string): string | undefined {
  if (token.type === 'COLOR') {
    const shown = /#[0-9a-f]{8}\b|#[0-9a-f]{6}\b/i.exec(segment)?.[0];
    const opaque = (value: string) =>
      value.toLowerCase().replace(/^(#[0-9a-f]{6})ff$/, '$1');
    return shown && opaque(shown) !== opaque(token.value) ? shown : undefined;
  }
  if (token.type === 'FLOAT') {
    const shown = /-?\d+(?:\.\d+)?/.exec(segment)?.[0];
    return shown !== undefined &&
      Math.abs(Number(shown) - token.value) > 0.00001
      ? shown
      : undefined;
  }
  if (token.type === 'BOOLEAN') {
    const shown = /\b(true|false)\b/i.exec(segment)?.[0];
    return shown && shown.toLowerCase() !== String(token.value)
      ? shown
      : undefined;
  }
  const shown = segment.replace(/^[\s|:=–—-]+/, '').trim();
  return shown && !shown.includes(token.value) ? shown : undefined;
}

function pageBackgroundWarnings(
  pages: NativeSystem['pages'],
  expected: string,
): CanvasFinding[] {
  return pages
    .filter((page) => page.background !== expected)
    .map((page) => ({
      code: 'page-background',
      message: `Page ${page.name} has background ${page.background ?? 'none'} instead of ${expected}, which keeps frame edges visible; run open-prototypen system apply`,
    }));
}

// `screenBases` maps variant screens to the base screen whose frame they render.
export function validateCanvas(
  project: string,
  screenFrames: Record<string, string>,
  screenBases: Record<string, string> = {},
): CanvasValidation {
  loadConfig(project);
  const findings: CanvasFinding[] = [];
  const summary = {
    tokens: 0,
    boundTokens: 0,
    components: 0,
    instances: 0,
    textContrast: { checked: 0, unchecked: 0 },
  };
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
  const sampleWarnings: CanvasFinding[] = [];
  const nodes = new Map(native.nodes.map((node) => [node.id, node]));
  // Instances inherit their master's bindings, so a binding inside a master counts as applied.
  const sampleOnly = (variableId: string, all: NativeNode[]) =>
    all
      .filter((node) =>
        Object.values(node.boundVariables ?? {}).includes(variableId),
      )
      .every(
        (node) =>
          pageOf(node, nodes)?.name === DESIGN_SYSTEM_PAGE &&
          node.type !== 'COMPONENT' &&
          !insideMaster(node, nodes),
      );
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
    else if (sampleOnly(variable.id, native.nodes))
      sampleWarnings.push({
        code: 'token-sample-only',
        message: `Native variable ${token.name} is bound only to samples on ${DESIGN_SYSTEM_PAGE}; bind it in component masters or screens too`,
      });
  }
  const declared = new Set(system.tokens.map((token) => token.name));
  const undeclared = variables
    .filter((variable) => !declared.has(variable.name))
    .map((variable) => ({
      code: 'token-undeclared',
      message: `Native variable ${variable.name} is not in system.yaml; declare it or run open-prototypen system apply --prune`,
    }));
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
        !instances.some((node) => {
          const master = linkedMaster(node, nodes);
          return (
            master !== undefined &&
            stateIds.has(master) &&
            descendsFrom(node, frameId, nodes)
          );
        })
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
    warnings: [
      ...contrastWarnings(system),
      ...offScaleWarnings(system, screenFrames, components, nodes),
      ...textContrastWarnings(
        project,
        screenFrames,
        components,
        nodes,
        summary,
      ),
      ...sampleWarnings,
      ...missingFonts(project).map(({ family, style, nodes: users }) => ({
        code: 'font-substitution',
        message: `${fontWarning(family, style)}. Used by: ${users.join(', ')}`,
      })),
      ...undeclared,
      ...masterPageWarnings(components, nodes),
      ...masterLabelWarnings(components, nodes),
      ...tokenLabelWarnings(system.tokens, nodes),
      ...componentUsageWarnings(
        screenBases,
        system,
        screenFrames,
        components,
        instances,
        nodes,
      ),
      ...pageBackgroundWarnings(native.pages, pageBackground(system)),
    ],
    summary,
  };
}
