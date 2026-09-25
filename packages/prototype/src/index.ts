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
import { packageRoot } from '../../schemas/src/index.js';
import {
  inspectCanvas,
  pngSize,
  renderFrame,
  sameSize,
  type Bounds,
  type DesignNode,
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
  z.object({ ...common, action: z.literal('open-overlay'), target: id }),
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
const interactionsSchema = z.object({
  version: z.literal(1),
  initialScreen: id,
  screens: z.record(
    id,
    z.object({
      frame: z.string().min(1),
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
  for (const [screen, entry] of Object.entries(data.screens))
    for (const [name, action] of Object.entries(entry.actions)) {
      if ('target' in action && action.target && !data.screens[action.target])
        throw new Error(`Unknown target ${action.target} in ${screen}.${name}`);
    }
  return data;
}
export type PrototypeWarning = CanvasFinding;
type RuntimeAction = z.infer<typeof actionSchema> & { bounds: Bounds };
type ResolvedScreen = {
  frame: DesignNode;
  bounds: Bounds;
  actions: Record<string, RuntimeAction>;
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
function resolveScreenFrame(
  index: RefIndex,
  name: string,
  entry: Interactions['screens'][string],
): PlacedNode {
  return contextual(`Screen ${name}`, () => resolveFrame(index, entry.frame));
}
function resolveScreen(
  index: RefIndex,
  name: string,
  entry: Interactions['screens'][string],
  warnings: PrototypeWarning[],
): ResolvedScreen {
  const frame = resolveScreenFrame(index, name, entry);
  warnings.push(...legacyWarning(`Screen ${name}`, entry.frame));
  const actions: Record<string, RuntimeAction> = {};
  for (const [actionName, action] of Object.entries(entry.actions)) {
    const context = `Action ${name}.${actionName}`;
    warnings.push(...legacyWarning(context, action.node));
    const target = contextual(context, () => {
      const placed = resolveNode(index, action.node);
      if (placed.frame.id !== frame.node.id || placed.node === frame.node)
        throw new Error(
          `${describeNode(placed.node)} is not inside frame ${describeNode(frame.node)}`,
        );
      return action.part ? resolvePart(placed, action.part) : placed;
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
    actions[actionName] = { ...action, bounds };
  }
  return { frame: frame.node, bounds: frame.bounds, actions };
}
function reachabilityWarnings(interactions: Interactions): PrototypeWarning[] {
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
  return Object.keys(interactions.screens)
    .filter((screen) => !reached.has(screen))
    .map((screen) => ({
      code: 'unreachable-screen',
      message: `Screen ${screen} cannot be reached from ${interactions.initialScreen} through any action target`,
    }));
}
export function resolveInteractions(
  project: string,
  interactions = readInteractions(project),
): { screens: Record<string, ResolvedScreen>; warnings: PrototypeWarning[] } {
  const index = openRefs(inspectCanvas(project).tree);
  const warnings: PrototypeWarning[] = [];
  const screens = Object.fromEntries(
    Object.entries(interactions.screens).map(([name, entry]) => [
      name,
      resolveScreen(index, name, entry, warnings),
    ]),
  );
  return {
    screens,
    warnings: [...warnings, ...reachabilityWarnings(interactions)],
  };
}
export function inspectScreen(project: string, screen: string) {
  const entry = readInteractions(project).screens[screen];
  if (!entry) throw new Error(`Unknown screen: ${screen}`);
  const warnings: PrototypeWarning[] = [];
  const resolved = resolveScreen(
    openRefs(inspectCanvas(project).tree),
    screen,
    entry,
    warnings,
  );
  return {
    screen,
    frame: { ...resolved.frame, bounds: resolved.bounds },
    actions: resolved.actions,
    warnings,
  };
}
export function renderScreens(project: string, screen?: string): string[] {
  const interactions = readInteractions(project);
  const entries = screen
    ? ([[screen, interactions.screens[screen]]] as const)
    : Object.entries(interactions.screens);
  const index = openRefs(inspectCanvas(project).tree);
  // Resolve every frame before exporting so a stale reference cannot overwrite a good render.
  const frames = entries.map(([name, entry]) => {
    if (!entry) throw new Error(`Unknown screen: ${name}`);
    return [name, resolveScreenFrame(index, name, entry)] as const;
  });
  return frames.map(([name, frame]) =>
    renderFrame(
      project,
      frame.node.id,
      join(workspace(project), 'prototype/renders', `${name}.png`),
      frame.bounds,
    ),
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
  const result = validateCanvas(
    project,
    Object.fromEntries(
      Object.entries(resolved?.screens ?? {}).map(([name, screen]) => [
        name,
        screen.frame.id,
      ]),
    ),
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
