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
  findNode,
  inspectCanvas,
  relativeBounds,
  renderFrame,
  type Bounds,
} from '../../openpencil/src/index.js';
import { validateCanvas } from '../../validator/src/canvas.js';

const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const when = z.object({ key: id, value: z.string() }).optional();
const common = {
  node: z.string().min(1),
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
export function inspectScreen(project: string, screen: string) {
  const entry = readInteractions(project).screens[screen];
  if (!entry) throw new Error(`Unknown screen: ${screen}`);
  const canvas = inspectCanvas(project);
  const frame = findNode(canvas.tree, entry.frame);
  if (!frame) throw new Error(`Unknown frame: ${entry.frame}`);
  return {
    screen,
    frame: { ...frame.node, bounds: frame.bounds },
    actions: Object.fromEntries(
      Object.entries(entry.actions).map(([name, action]) => [
        name,
        {
          ...action,
          bounds: relativeBounds(canvas.tree, entry.frame, action.node),
        },
      ]),
    ),
  };
}
export function renderScreens(project: string, screen?: string): string[] {
  const interactions = readInteractions(project);
  const canvas = inspectCanvas(project);
  const entries = screen
    ? ([[screen, interactions.screens[screen]]] as const)
    : Object.entries(interactions.screens);
  const output: string[] = [];
  for (const [name, entry] of entries) {
    if (!entry) throw new Error(`Unknown screen: ${name}`);
    if (!findNode(canvas.tree, entry.frame))
      throw new Error(`Unknown frame: ${entry.frame}`);
    const path = join(workspace(project), 'prototype/renders', `${name}.png`);
    output.push(renderFrame(project, entry.frame, path));
  }
  return output;
}

type RuntimeAction = z.infer<typeof actionSchema> & { bounds: Bounds };
export function compilePrototype(project: string): {
  output: string;
  screens: number;
} {
  const interactions = readInteractions(project);
  if (loadConfig(project).quality.nativeDesignSystem) {
    const frames = Object.fromEntries(
      Object.entries(interactions.screens).map(([name, screen]) => [
        name,
        screen.frame,
      ]),
    );
    const validation = validateCanvas(project, frames);
    if (!validation.valid)
      throw new Error(
        `Native design system is invalid: ${validation.findings.map((finding) => finding.message).join('; ')}`,
      );
  }
  const canvas = inspectCanvas(project);
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
    const frame = findNode(canvas.tree, entry.frame);
    if (!frame) throw new Error(`Unknown frame: ${entry.frame}`);
    const image = join(workspace(project), 'prototype/renders', `${name}.png`);
    if (!existsSync(image))
      throw new Error(`Missing render for ${name}. Run render first.`);
    copyFileSync(image, join(output, 'screens', `${name}.png`));
    const actions: Record<string, RuntimeAction> = {};
    for (const [actionName, action] of Object.entries(entry.actions))
      actions[actionName] = {
        ...action,
        bounds: relativeBounds(canvas.tree, entry.frame, action.node),
      };
    screens[name] = {
      width: frame.bounds.width,
      height: frame.bounds.height,
      title: entry.title,
      content: entry.content,
      actions,
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
  return { output, screens: Object.keys(screens).length };
}
