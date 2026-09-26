import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import {
  loadConfig,
  resolveProjectLanguage,
  workspace,
} from '../../core/src/index.js';
import {
  pageBackground,
  readDesignSystem,
  tokenValue,
} from '../../core/src/system.js';
import { packageRoot } from '../../schemas/src/index.js';
import {
  inspectCanvas,
  pngSize,
  renderFrame,
  renderPage,
  sameSize,
  type Bounds,
  type DesignNode,
  type RenderOptions,
} from '../../openpencil/src/index.js';
import {
  describeNode,
  indexRefs,
  isNodeId,
  resolveFrame,
  resolveNode,
  resolvePart,
  type PlacedNode,
  type RefIndex,
} from '../../openpencil/src/refs.js';
import {
  validateCanvas,
  type CanvasFinding,
  type CanvasValidation,
} from '../../validator/src/canvas.js';

const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const when = z.object({ key: id, value: z.string() }).optional();
const common = {
  node: z.string().min(1),
  part: z.string().min(1).optional(),
  label: z.string().min(1),
  event: z.literal('click').default('click'),
  when,
};
const actionSchema = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('navigate'), target: id }),
  z.object({ ...common, action: z.literal('back') }),
  z.object({
    ...common,
    action: z.literal('open-overlay'),
    target: id,
    placement: z.enum(['center', 'bottom']).default('center'),
  }),
  z.object({ ...common, action: z.literal('close-overlay') }),
  z.object({
    ...common,
    action: z.literal('set-state'),
    key: id,
    value: z.string(),
    target: id.optional(),
  }),
  z.object({
    ...common,
    action: z.literal('external-link'),
    url: z
      .url()
      .refine(
        (value) => /^https?:/.test(value),
        'Only HTTP(S) URLs are supported',
      ),
  }),
]);
// Scenarios simulate outcomes outside the product's control, such as a server response, from a
// runtime panel outside the screens instead of drawn controls.
const scenarioSchema = z.object({
  key: id,
  label: z.string().min(1),
  initial: z.string(),
  values: z
    .array(z.object({ value: z.string(), label: z.string().min(1) }))
    .min(2),
});
const interactionsSchema = z.object({
  version: z.literal(1),
  initialScreen: id,
  scenarios: z.array(scenarioSchema).default([]),
  screens: z.record(
    id,
    z.object({
      // A screen has its own frame, or derives from the frame of a base screen with overrides.
      frame: z.string().min(1).optional(),
      base: id.optional(),
      overrides: z
        .object({
          text: z.record(z.string(), z.string()).default({}),
          hidden: z.array(z.string()).default([]),
          shown: z.array(z.string()).default([]),
        })
        .strict()
        .optional(),
      title: z.string().min(1),
      content: z.string().min(1),
      actions: z.record(id, actionSchema).default({}),
    }),
  ),
});
export type Interactions = z.infer<typeof interactionsSchema>;
export function interactionsPath(project: string): string {
  return join(workspace(project), 'prototype/interactions.yaml');
}
export function readInteractions(project: string): Interactions {
  const path = interactionsPath(project);
  if (!existsSync(path))
    throw new Error(`Interactions file does not exist: ${path}`);
  const data = interactionsSchema.parse(YAML.parse(readFileSync(path, 'utf8')));
  if (!data.screens[data.initialScreen])
    throw new Error(`Unknown initial screen: ${data.initialScreen}`);
  for (const [screen, entry] of Object.entries(data.screens)) {
    if (Boolean(entry.frame) === Boolean(entry.base))
      throw new Error(`Screen ${screen} needs either a frame or a base`);
    if (entry.overrides && !entry.base)
      throw new Error(`Screen ${screen} has overrides but no base`);
    if (entry.base && !data.screens[entry.base]?.frame)
      throw new Error(
        `Screen ${screen} has base ${entry.base}, which is not a screen with its own frame`,
      );
  }
  for (const [screen, entry] of Object.entries(data.screens))
    for (const [name, action] of Object.entries(entry.actions)) {
      if ('target' in action && action.target && !data.screens[action.target])
        throw new Error(`Unknown target ${action.target} in ${screen}.${name}`);
    }
  const keys = new Set<string>();
  for (const scenario of data.scenarios) {
    if (keys.has(scenario.key))
      throw new Error(`Duplicate scenario key: ${scenario.key}`);
    keys.add(scenario.key);
    const values = scenario.values.map((entry) => entry.value);
    const duplicate = values.find(
      (value, index) => values.indexOf(value) !== index,
    );
    if (duplicate !== undefined)
      throw new Error(
        `Duplicate value ${duplicate} in scenario ${scenario.key}`,
      );
    if (!values.includes(scenario.initial))
      throw new Error(
        `Initial value ${scenario.initial} of scenario ${scenario.key} is not one of its values: ${values.join(', ')}`,
      );
  }
  return data;
}
export type PrototypeWarning = CanvasFinding;
// Actions on the same resolved node share a `slot`, named after the first of them so it survives
// ID renumbering. The runtime renders one hotspot per slot.
type RuntimeAction = z.infer<typeof actionSchema> & {
  bounds: Bounds;
  slot: string;
};
type ResolvedScreen = {
  frame: DesignNode;
  bounds: Bounds;
  actions: Record<string, RuntimeAction>;
  overrides?: ResolvedOverrides;
};
// Overrides of a variant screen, by node ID in the base frame.
type ResolvedOverrides = {
  text: { id: string; value: string }[];
  hidden: string[];
  shown: string[];
};

function contextual<T>(context: string, resolve: () => T): T {
  try {
    return resolve();
  } catch (error) {
    throw new Error(
      `${context}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
function openRefs(tree: DesignNode[]): RefIndex {
  const index = indexRefs(tree);
  if (index.problems.length) throw new Error(index.problems.join('; '));
  return index;
}
function legacyWarning(context: string, reference: string): PrototypeWarning[] {
  return isNodeId(reference)
    ? [
        {
          code: 'node-id',
          message: `${context} uses node ID ${reference}; IDs change when nodes are inserted or removed. Assign a stable reference with open-prototypen ref set ${reference}=<ref>.`,
        },
      ]
    : [];
}
// The frame reference of a screen, or of its base for a variant.
function frameReference(interactions: Interactions, name: string): string {
  const entry = interactions.screens[name];
  const frame = entry?.base
    ? interactions.screens[entry.base]?.frame
    : entry?.frame;
  if (!frame) throw new Error(`Unknown screen: ${name}`);
  return frame;
}
function resolveScreenFrame(
  index: RefIndex,
  name: string,
  interactions: Interactions,
): PlacedNode {
  return contextual(`Screen ${name}`, () =>
    resolveFrame(index, frameReference(interactions, name)),
  );
}
// Override targets are references, or <ref>:<part> for a layer inside a referenced instance.
function resolveOverrides(
  index: RefIndex,
  name: string,
  frame: PlacedNode,
  overrides: NonNullable<Interactions['screens'][string]['overrides']>,
): ResolvedOverrides & { hiddenIds: Set<string> } {
  const target = (key: string): PlacedNode =>
    contextual(`Screen ${name} override ${key}`, () => {
      const separator = key.indexOf(':');
      const reference = separator < 0 ? key : key.slice(0, separator);
      const placed = resolveNode(index, reference);
      if (placed.frame.id !== frame.node.id || placed.node === frame.node)
        throw new Error(
          `${describeNode(placed.node)} is not inside frame ${describeNode(frame.node)}`,
        );
      return separator < 0
        ? placed
        : resolvePart(placed, key.slice(separator + 1));
    });
  const text = Object.entries(overrides.text).map(([key, value]) => {
    const placed = target(key);
    if (placed.node.type !== 'TEXT')
      throw new Error(
        `Screen ${name} override ${key}: ${describeNode(placed.node)} is not a text node`,
      );
    return { id: placed.node.id, value };
  });
  const hidden = overrides.hidden.map((key) => target(key).node);
  const shown = overrides.shown.map((key) => target(key).node.id);
  const both = hidden.find((node) => shown.includes(node.id));
  if (both)
    throw new Error(
      `Screen ${name} both hides and shows ${describeNode(both)}`,
    );
  const hiddenIds = new Set<string>();
  const collect = (node: DesignNode) => {
    hiddenIds.add(node.id);
    for (const child of node.children ?? []) collect(child);
  };
  hidden.forEach(collect);
  return { text, hidden: hidden.map((node) => node.id), shown, hiddenIds };
}
function resolveScreen(
  index: RefIndex,
  name: string,
  interactions: Interactions,
  warnings: PrototypeWarning[],
): ResolvedScreen {
  const entry = interactions.screens[name];
  if (!entry) throw new Error(`Unknown screen: ${name}`);
  const frame = resolveScreenFrame(index, name, interactions);
  if (entry.frame)
    warnings.push(...legacyWarning(`Screen ${name}`, entry.frame));
  const overrides = entry.overrides
    ? resolveOverrides(index, name, frame, entry.overrides)
    : undefined;
  const actions: Record<string, RuntimeAction> = {};
  const targets: { name: string; action: RuntimeAction }[] = [];
  const slots = new Map<string, string>();
  for (const [actionName, action] of Object.entries(entry.actions)) {
    const context = `Action ${name}.${actionName}`;
    warnings.push(...legacyWarning(context, action.node));
    const target = contextual(context, () => {
      const placed = resolveNode(index, action.node);
      if (placed.frame.id !== frame.node.id || placed.node === frame.node)
        throw new Error(
          `${describeNode(placed.node)} is not inside frame ${describeNode(frame.node)}`,
        );
      const resolved = action.part ? resolvePart(placed, action.part) : placed;
      if (overrides?.hiddenIds.has(resolved.node.id))
        throw new Error(
          `${describeNode(resolved.node)} is hidden in this variant`,
        );
      return resolved;
    });
    const bounds = {
      x: target.bounds.x - frame.bounds.x,
      y: target.bounds.y - frame.bounds.y,
      width: target.bounds.width,
      height: target.bounds.height,
    };
    // Headless OpenPencil leaves unmeasured text at its 100×100 default; an explicit size is trusted.
    const unmeasured =
      target.node.type === 'TEXT' &&
      target.node.width === 100 &&
      target.node.height === 100;
    const textHint = unmeasured
      ? ' This text node still has the 100×100 default size because headless OpenPencil does not measure text; size it explicitly or use a sized container or a transparent hit area as the action node.'
      : '';
    if (bounds.width <= 0 || bounds.height <= 0)
      throw new Error(
        `${context}: ${describeNode(target.node)} has empty bounds`,
      );
    // One pixel of tolerance absorbs rounding of fractional geometry.
    if (
      bounds.x < -1 ||
      bounds.y < -1 ||
      bounds.x + bounds.width > frame.bounds.width + 1 ||
      bounds.y + bounds.height > frame.bounds.height + 1
    )
      throw new Error(
        `${context}: hotspot ${bounds.width}×${bounds.height} at ${bounds.x},${bounds.y} extends outside frame ${frame.node.name} (${frame.bounds.width}×${frame.bounds.height}).${textHint}`,
      );
    if (unmeasured)
      warnings.push({ code: 'text-action', message: `${context}:${textHint}` });
    const slot = slots.get(target.node.id) ?? actionName;
    slots.set(target.node.id, slot);
    const runtime = { ...action, bounds, slot };
    actions[actionName] = runtime;
    targets.push({ name: actionName, action: runtime });
  }
  warnings.push(...coveredActionWarnings(name, targets));
  warnings.push(...smallTargetWarnings(name, targets));
  return {
    frame: frame.node,
    bounds: frame.bounds,
    actions,
    ...(overrides && {
      overrides: {
        text: overrides.text,
        hidden: overrides.hidden,
        shown: overrides.shown,
      },
    }),
  };
}
// WCAG 2.2 SC 2.5.8 asks for 24×24 CSS px targets, unless a 24 px circle centered on an undersized
// target meets no other target and no other undersized target's circle. Actions sharing a node form
// one hotspot; two hotspots conflict only when some of their actions can be active together.
const MINIMUM_TARGET = 24;
function smallTargetWarnings(
  screen: string,
  targets: { name: string; action: RuntimeAction }[],
): PrototypeWarning[] {
  const groups = new Map<string, { name: string; action: RuntimeAction }[]>();
  for (const target of targets)
    groups.set(target.action.slot, [
      ...(groups.get(target.action.slot) ?? []),
      target,
    ]);
  const hotspots = [...groups.values()].map((group) => ({
    name: group[0]?.name ?? '',
    bounds: (group[0] as { action: RuntimeAction }).action.bounds,
    actions: group.map((target) => target.action),
  }));
  const small = (bounds: Bounds) =>
    bounds.width < MINIMUM_TARGET || bounds.height < MINIMUM_TARGET;
  const center = (bounds: Bounds) => ({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  });
  const radius = MINIMUM_TARGET / 2;
  const exclusive = (a: RuntimeAction, b: RuntimeAction) =>
    !!a.when &&
    !!b.when &&
    a.when.key === b.when.key &&
    a.when.value !== b.when.value;
  const together = (
    a: (typeof hotspots)[number],
    b: (typeof hotspots)[number],
  ) =>
    a.actions.some((first) =>
      b.actions.some((second) => !exclusive(first, second)),
    );
  // The distance from a point to the nearest point of a rectangle.
  const distance = (point: { x: number; y: number }, bounds: Bounds) =>
    Math.hypot(
      Math.max(bounds.x - point.x, 0, point.x - (bounds.x + bounds.width)),
      Math.max(bounds.y - point.y, 0, point.y - (bounds.y + bounds.height)),
    );
  return hotspots.flatMap((hotspot) => {
    if (!small(hotspot.bounds)) return [];
    const origin = center(hotspot.bounds);
    const crowded = hotspots.some(
      (other) =>
        other !== hotspot &&
        together(hotspot, other) &&
        (distance(origin, other.bounds) < radius ||
          (small(other.bounds) &&
            Math.hypot(
              center(other.bounds).x - origin.x,
              center(other.bounds).y - origin.y,
            ) <
              2 * radius)),
    );
    if (!crowded) return [];
    const { width, height } = hotspot.bounds;
    return [
      {
        code: 'small-target',
        message: `Action ${screen}.${hotspot.name}: hotspot ${width}×${height} is smaller than the 24×24 minimum (WCAG 2.5.8) and too close to another target for the spacing exception. Enlarge it with a transparent hit area, move it apart, or accept it in the audit if an inline, equivalent, or essential exception applies.`,
      },
    ];
  });
}
// The runtime renders only the last active action on each node, so a later action on the same node wins.
// An earlier action is dead when that later one is active in every state where it is active.
function coveredActionWarnings(
  screen: string,
  targets: { name: string; action: RuntimeAction }[],
): PrototypeWarning[] {
  return targets.flatMap((earlier, index) => {
    const cover = targets
      .slice(index + 1)
      .find(
        (later) =>
          later.action.slot === earlier.action.slot &&
          (!later.action.when ||
            (later.action.when.key === earlier.action.when?.key &&
              later.action.when.value === earlier.action.when.value)),
      );
    return cover
      ? [
          {
            code: 'covered-action',
            message: `Action ${screen}.${earlier.name} can never be clicked: ${screen}.${cover.name}, declared later on the same node, is active whenever it is. Declare the default action first and give the later action on the same node a when condition that differs.`,
          },
        ]
      : [];
  });
}
// Explored (screen, overlay, state) nodes before falling back to plain target reachability.
const REACHABILITY_LIMIT = 50000;
type Visit = { screen: string; overlay: string | null; state: string[] };
// Follows actions the way the runtime does, over (screen, overlay, state) nodes. State tracks only
// keys some `when` tests; scenario controls may switch their values at any time. `back` may return
// to any screen that leads to the current one, which over-approximates the runtime's history.
export function reachabilityWarnings(
  interactions: Interactions,
): PrototypeWarning[] {
  const { screens, scenarios } = interactions;
  const entries = Object.entries(screens).flatMap(([screen, entry]) =>
    Object.entries(entry.actions).map(([name, action]) => ({
      screen,
      name,
      action,
    })),
  );
  const produced = new Map<string, Set<string>>();
  const produce = (key: string, value: string) =>
    produced.set(key, (produced.get(key) ?? new Set()).add(value));
  for (const scenario of scenarios)
    for (const entry of scenario.values) produce(scenario.key, entry.value);
  for (const { action } of entries)
    if (action.action === 'set-state') produce(action.key, action.value);
  const scenarioKeys = new Set(scenarios.map((scenario) => scenario.key));
  // Scenario keys get unknown-scenario-value instead.
  const warnings: PrototypeWarning[] = entries
    .filter(
      ({ action }) =>
        action.when &&
        !scenarioKeys.has(action.when.key) &&
        !produced.get(action.when.key)?.has(action.when.value),
    )
    .map(({ screen, name, action }) => ({
      code: 'unsatisfiable-when',
      message: `Action ${screen}.${name} waits for ${action.when?.key} = ${action.when?.value}, which no set-state action or scenario produces, so it can never run`,
    }));
  const keys = [
    ...new Set(entries.flatMap(({ action }) => action.when?.key ?? [])),
  ].sort();
  const index = new Map(keys.map((key, position) => [key, position]));
  const sources = new Map<string, Set<string>>();
  for (const { screen, action } of entries)
    if (
      (action.action === 'navigate' || action.action === 'set-state') &&
      action.target
    )
      sources.set(
        action.target,
        (sources.get(action.target) ?? new Set()).add(screen),
      );
  const set = (state: string[], key: string, value: string) => {
    const position = index.get(key);
    if (position === undefined || state[position] === value) return state;
    const next = [...state];
    next[position] = value;
    return next;
  };
  const initial = keys.map(
    (key) => scenarios.find((scenario) => scenario.key === key)?.initial ?? '',
  );
  const reached = new Set<string>();
  const seen = new Set<string>();
  const queue: Visit[] = [
    { screen: interactions.initialScreen, overlay: null, state: initial },
  ];
  const visit = (next: Visit) => {
    const id = JSON.stringify(next);
    if (!seen.has(id)) {
      seen.add(id);
      queue.push(next);
    }
  };
  seen.add(JSON.stringify(queue[0]));
  for (let node = queue.shift(); node; node = queue.shift()) {
    if (seen.size > REACHABILITY_LIMIT)
      return [...warnings, ...targetOnly(interactions)];
    const { screen, overlay, state } = node;
    reached.add(screen);
    if (overlay) reached.add(overlay);
    for (const scenario of scenarios)
      for (const entry of scenario.values)
        visit({
          screen,
          overlay,
          state: set(state, scenario.key, entry.value),
        });
    // An open overlay makes the screen below inert.
    for (const action of Object.values(
      screens[overlay ?? screen]?.actions ?? {},
    )) {
      if (
        action.when &&
        state[index.get(action.when.key) ?? -1] !== action.when.value
      )
        continue;
      switch (action.action) {
        case 'navigate':
          visit({ screen: action.target, overlay: null, state });
          break;
        case 'back':
          for (const source of sources.get(screen) ?? [
            interactions.initialScreen,
          ])
            visit({ screen: source, overlay: null, state });
          break;
        case 'open-overlay':
          visit({ screen, overlay: action.target, state });
          break;
        case 'close-overlay':
          visit({ screen, overlay: null, state });
          break;
        case 'set-state': {
          const next = set(state, action.key, action.value);
          visit(
            action.target
              ? { screen: action.target, overlay: null, state: next }
              : { screen, overlay, state: next },
          );
          break;
        }
      }
    }
  }
  return [...warnings, ...unreachable(interactions, reached)];
}
function targetOnly(interactions: Interactions): PrototypeWarning[] {
  const reached = new Set([interactions.initialScreen]);
  const queue = [interactions.initialScreen];
  for (let screen = queue.shift(); screen; screen = queue.shift())
    for (const action of Object.values(
      interactions.screens[screen]?.actions ?? {},
    ))
      if ('target' in action && action.target && !reached.has(action.target)) {
        reached.add(action.target);
        queue.push(action.target);
      }
  return unreachable(interactions, reached);
}
function unreachable(
  interactions: Interactions,
  reached: Set<string>,
): PrototypeWarning[] {
  return Object.keys(interactions.screens)
    .filter((screen) => !reached.has(screen))
    .map((screen) => ({
      code: 'unreachable-screen',
      message: `Screen ${screen} cannot be reached from ${interactions.initialScreen} through any action whose when condition can hold`,
    }));
}
function scenarioWarnings(interactions: Interactions): PrototypeWarning[] {
  const warnings: PrototypeWarning[] = [];
  const conditions = Object.entries(interactions.screens).flatMap(
    ([screen, entry]) =>
      Object.entries(entry.actions).flatMap(([name, action]) =>
        action.when ? [{ name: `${screen}.${name}`, when: action.when }] : [],
      ),
  );
  for (const scenario of interactions.scenarios) {
    const used = conditions.filter(
      (condition) => condition.when.key === scenario.key,
    );
    if (!used.length)
      warnings.push({
        code: 'unused-scenario',
        message: `Scenario ${scenario.key} is not used by any action's when condition, so switching it changes nothing`,
      });
    const values = scenario.values.map((entry) => entry.value);
    for (const condition of used)
      if (!values.includes(condition.when.value))
        warnings.push({
          code: 'unknown-scenario-value',
          message: `Action ${condition.name} waits for ${scenario.key} = ${condition.when.value}, which scenario ${scenario.key} does not declare (${values.join(', ')})`,
        });
  }
  return warnings;
}
export function resolveInteractions(
  project: string,
  interactions = readInteractions(project),
): { screens: Record<string, ResolvedScreen>; warnings: PrototypeWarning[] } {
  const index = openRefs(inspectCanvas(project).tree);
  const warnings: PrototypeWarning[] = [];
  const screens = Object.fromEntries(
    Object.keys(interactions.screens).map((name) => [
      name,
      resolveScreen(index, name, interactions, warnings),
    ]),
  );
  return {
    screens,
    warnings: [
      ...warnings,
      ...reachabilityWarnings(interactions),
      ...scenarioWarnings(interactions),
    ],
  };
}
export function inspectScreen(project: string, screen: string) {
  const warnings: PrototypeWarning[] = [];
  const resolved = resolveScreen(
    openRefs(inspectCanvas(project).tree),
    screen,
    readInteractions(project),
    warnings,
  );
  return {
    screen,
    frame: { ...resolved.frame, bounds: resolved.bounds },
    actions: resolved.actions,
    ...(resolved.overrides && { overrides: resolved.overrides }),
    warnings,
  };
}
// Applies a variant's overrides to a temporary copy of the document before its base frame is
// exported. Overrides change no nodes' existence, so node IDs stay valid in the copy.
function overrideScript(overrides: ResolvedOverrides): string {
  return `
    const overrides = ${JSON.stringify(overrides)};
    for (const { id, value } of overrides.text) figma.getNodeById(id).characters = value;
    for (const id of overrides.hidden) figma.getNodeById(id).visible = false;
    for (const id of overrides.shown) figma.getNodeById(id).visible = true;
    return true;`;
}
// Maps each variant screen to its base, so component checks treat a variant like its base.
function screenBases(interactions: Interactions): Record<string, string> {
  return Object.fromEntries(
    Object.entries(interactions.screens).flatMap(([name, entry]) =>
      entry.base ? [[name, entry.base]] : [],
    ),
  );
}
export function renderScreens(
  project: string,
  screen?: string,
  options: RenderOptions = {},
): string[] {
  const interactions = readInteractions(project);
  const entries = screen
    ? ([[screen, interactions.screens[screen]]] as const)
    : Object.entries(interactions.screens);
  const index = openRefs(inspectCanvas(project).tree);
  // Resolve every frame and override before exporting so a stale reference cannot overwrite a
  // good render.
  const frames = entries.map(([name, entry]) => {
    if (!entry) throw new Error(`Unknown screen: ${name}`);
    const frame = resolveScreenFrame(index, name, interactions);
    const overrides =
      entry.overrides && resolveOverrides(index, name, frame, entry.overrides);
    return { name, frame, overrides };
  });
  return frames.map(({ name, frame, overrides }) =>
    renderFrame(
      project,
      frame.node.id,
      join(workspace(project), 'prototype/renders', `${name}.png`),
      frame.bounds,
      { ...options, prepare: overrides && overrideScript(overrides) },
    ),
  );
}
export { DESIGN_SYSTEM_PAGE } from '../../validator/src/canvas.js';
export function pageRenderPath(project: string, page: string): string {
  const slug = page
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!slug) throw new Error(`Cannot name a render for page ${page}`);
  // Pages render outside renders/<screen>.png, since design-system is also a valid screen key.
  return join(workspace(project), 'prototype/renders/pages', `${slug}.png`);
}
// An explicit color wins, then a declared canvas token, then the page background system apply sets.
function pageRenderBackground(project: string, background?: string): string {
  if (background) {
    if (!/^#[0-9a-fA-F]{6}$/.test(background))
      throw new Error(`Expected --background as #RRGGBB, got ${background}`);
    return background;
  }
  let system: ReturnType<typeof readDesignSystem>;
  try {
    system = readDesignSystem(project);
  } catch {
    return '#FFFFFF';
  }
  const canvas = system.tokens.find(
    (token) =>
      token.type === 'COLOR' &&
      ['color/canvas', 'color.canvas'].includes(token.name),
  );
  return canvas && canvas.type === 'COLOR'
    ? canvas.value.slice(0, 7)
    : pageBackground(system);
}
export function renderPages(
  project: string,
  pages: string[],
  background?: string,
  options: RenderOptions = {},
): string[] {
  const color = pageRenderBackground(project, background);
  const rgb = tokenValue({ name: 'background', type: 'COLOR', value: color });
  if (typeof rgb !== 'object') throw new Error('Invalid background color');
  const outputs = pages.map((page) => pageRenderPath(project, page));
  const duplicate = outputs.find(
    (output, index) => outputs.indexOf(output) !== index,
  );
  if (duplicate)
    throw new Error(`Two pages would render to the same file: ${duplicate}`);
  return pages.map((page, index) =>
    renderPage(project, page, outputs[index] as string, rgb, options),
  );
}
export function validatePrototypeCanvas(project: string): CanvasValidation {
  let resolved: ReturnType<typeof resolveInteractions> | undefined;
  let interactionError: string | undefined;
  try {
    resolved = resolveInteractions(project);
  } catch (error) {
    interactionError = error instanceof Error ? error.message : String(error);
  }
  let bases: Record<string, string> = {};
  try {
    bases = screenBases(readInteractions(project));
  } catch {
    // The interactions error is already reported.
  }
  const result = validateCanvas(
    project,
    Object.fromEntries(
      Object.entries(resolved?.screens ?? {}).map(([name, screen]) => [
        name,
        screen.frame.id,
      ]),
    ),
    bases,
  );
  if (interactionError) {
    result.findings.push({ code: 'interactions', message: interactionError });
    result.valid = false;
  }
  result.warnings.push(...(resolved?.warnings ?? []));
  return result;
}

export function compilePrototype(project: string): {
  output: string;
  screens: number;
  warnings: PrototypeWarning[];
} {
  const interactions = readInteractions(project);
  const resolved = resolveInteractions(project, interactions);
  if (loadConfig(project).quality.nativeDesignSystem) {
    const validation = validateCanvas(
      project,
      Object.fromEntries(
        Object.entries(resolved.screens).map(([name, screen]) => [
          name,
          screen.frame.id,
        ]),
      ),
      screenBases(interactions),
    );
    if (!validation.valid)
      throw new Error(
        `Native design system is invalid: ${validation.findings.map((finding) => finding.message).join('; ')}`,
      );
    resolved.warnings.push(...validation.warnings);
  }
  const output = join(workspace(project), 'prototype/dist');
  mkdirSync(join(output, 'screens'), { recursive: true });
  const screens: Record<
    string,
    {
      width: number;
      height: number;
      title: string;
      content: string;
      actions: Record<string, RuntimeAction>;
    }
  > = {};
  for (const [name, entry] of Object.entries(interactions.screens)) {
    const screen = resolved.screens[name] as ResolvedScreen;
    const image = join(workspace(project), 'prototype/renders', `${name}.png`);
    if (!existsSync(image))
      throw new Error(`Missing render for ${name}. Run render first.`);
    const size = pngSize(image);
    if (!sameSize(size, screen.bounds))
      throw new Error(
        `Render for ${name} is ${size.width}×${size.height} but frame ${screen.frame.name} is ${screen.bounds.width}×${screen.bounds.height}. Run render again.`,
      );
    copyFileSync(image, join(output, 'screens', `${name}.png`));
    screens[name] = {
      width: screen.bounds.width,
      height: screen.bounds.height,
      title: entry.title,
      content: entry.content,
      actions: screen.actions,
    };
  }
  const manifest = {
    version: 1,
    initialScreen: interactions.initialScreen,
    scenarios: interactions.scenarios,
    screens,
  };
  writeFileSync(
    join(output, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  const safeData = JSON.stringify(manifest).replace(/</g, '\\u003c');
  const htmlLang = resolveProjectLanguage(project).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ] ?? character,
  );
  const html = readFileSync(
    join(packageRoot(), 'runtime/prototype/index.html'),
    'utf8',
  )
    .replace('__LANG__', htmlLang)
    .replace('__DATA__', safeData);
  writeFileSync(join(output, 'index.html'), html);
  return {
    output,
    screens: Object.keys(screens).length,
    warnings: resolved.warnings,
  };
}
