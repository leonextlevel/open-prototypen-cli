import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { workspace } from './index.js';

const name = z.string().trim().min(1);
const tokenSchema = z.discriminatedUnion('type', [
  z.object({
    name,
    type: z.literal('COLOR'),
    value: z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/),
  }),
  z.object({ name, type: z.literal('FLOAT'), value: z.number().finite() }),
  z.object({ name, type: z.literal('STRING'), value: z.string().min(1) }),
  z.object({ name, type: z.literal('BOOLEAN'), value: z.boolean() }),
]);
const componentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !value.includes('/'), 'Component name cannot contain /'),
  states: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .refine((value) => !value.includes('/'), 'State name cannot contain /'),
    )
    .min(1),
  screens: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).default([]),
});
const systemSchema = z
  .object({
    version: z.literal(1),
    tokens: z.array(tokenSchema).min(1),
    components: z.array(componentSchema).min(1),
    pageBackground: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .superRefine((system, context) => {
    if (system.pageBackground) {
      const problem = pageBackgroundProblem(
        system.pageBackground,
        system.tokens,
      );
      if (problem)
        context.addIssue({
          code: 'custom',
          message: problem,
          path: ['pageBackground'],
        });
    }
    const tokenNames = new Set<string>();
    for (const [index, token] of system.tokens.entries()) {
      if (tokenNames.has(token.name))
        context.addIssue({
          code: 'custom',
          message: `Duplicate token: ${token.name}`,
          path: ['tokens', index, 'name'],
        });
      tokenNames.add(token.name);
    }
    const componentNames = new Set<string>();
    for (const [index, component] of system.components.entries()) {
      if (componentNames.has(component.name))
        context.addIssue({
          code: 'custom',
          message: `Duplicate component: ${component.name}`,
          path: ['components', index, 'name'],
        });
      componentNames.add(component.name);
      if (new Set(component.states).size !== component.states.length)
        context.addIssue({
          code: 'custom',
          message: `Duplicate state in ${component.name}`,
          path: ['components', index, 'states'],
        });
      if (new Set(component.screens).size !== component.screens.length)
        context.addIssue({
          code: 'custom',
          message: `Duplicate screen in ${component.name}`,
          path: ['components', index, 'screens'],
        });
    }
  });

export type DesignSystem = z.infer<typeof systemSchema>;
export type DesignToken = DesignSystem['tokens'][number];
export function systemPath(project: string): string {
  return join(workspace(project), 'design/system.yaml');
}
export function readDesignSystem(project: string): DesignSystem {
  const path = systemPath(project);
  if (!existsSync(path))
    throw new Error(`Design system manifest does not exist: ${path}`);
  return systemSchema.parse(YAML.parse(readFileSync(path, 'utf8')));
}

export function tokenValue(
  token: DesignToken,
): { r: number; g: number; b: number; a: number } | number | string | boolean {
  if (token.type !== 'COLOR') return token.value;
  const hex = token.value.slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16) / 255,
    g: Number.parseInt(hex.slice(2, 4), 16) / 255,
    b: Number.parseInt(hex.slice(4, 6), 16) / 255,
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

export function sameTokenValue(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' && typeof expected === 'number')
    return Math.abs(actual - expected) < 0.00001;
  if (
    actual &&
    expected &&
    typeof actual === 'object' &&
    typeof expected === 'object'
  ) {
    const left = actual as Record<string, unknown>,
      right = expected as Record<string, unknown>;
    return Object.keys(right).every((key) =>
      sameTokenValue(left[key], right[key]),
    );
  }
  return actual === expected;
}

// Page backgrounds are neutral grays kept visibly apart from every opaque token color, so frame
// edges stay readable in the editor. Distances are Euclidean in OKLab, where 0.02 is barely visible.
export const PAGE_BACKGROUND_MIN_DISTANCE = 0.08;
const PAGE_BACKGROUND_MAX_CHROMA = 0.02;
const DEFAULT_PAGE_BACKGROUND = '#D4D4D4';
type Rgb = { r: number; g: number; b: number };

export function hexColor(color: Rgb): string {
  return (
    '#' +
    [color.r, color.g, color.b]
      .map((channel) =>
        Math.round(Math.min(1, Math.max(0, channel)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}

function oklab({ r, g, b }: Rgb): [number, number, number] {
  const linear = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function opaqueColors(tokens: DesignToken[]): Rgb[] {
  return tokens.flatMap((token) => {
    const value = tokenValue(token);
    return typeof value === 'object' && value.a === 1 ? [value] : [];
  });
}

function nearestDistance(color: Rgb, palette: Rgb[]): number {
  const [l, a, b] = oklab(color);
  return Math.min(
    ...palette.map((other) => {
      const [ol, oa, ob] = oklab(other);
      return Math.hypot(l - ol, a - oa, b - ob);
    }),
  );
}

function pageBackgroundProblem(
  hex: string,
  tokens: DesignToken[],
): string | undefined {
  const color = tokenValue({
    name: 'pageBackground',
    type: 'COLOR',
    value: hex,
  });
  if (typeof color !== 'object') return undefined;
  const [, a, b] = oklab(color);
  if (Math.hypot(a, b) > PAGE_BACKGROUND_MAX_CHROMA)
    return `Page background ${hex} is not a neutral gray`;
  const palette = opaqueColors(tokens);
  if (
    palette.length &&
    nearestDistance(color, palette) < PAGE_BACKGROUND_MIN_DISTANCE
  )
    return `Page background ${hex} is too close to a token color`;
  return undefined;
}

// The declared background, or the gray closest in lightness to the palette's likely page color
// (its lightest color in a mostly light palette, its darkest otherwise) that still stays
// PAGE_BACKGROUND_MIN_DISTANCE away from every opaque token color, so the page is only slightly
// different from screen fills. Without such a gray, the one farthest from the palette wins.
export function pageBackground(system: DesignSystem): string {
  if (system.pageBackground) return system.pageBackground.toUpperCase();
  const palette = opaqueColors(system.tokens);
  if (!palette.length) return DEFAULT_PAGE_BACKGROUND;
  const lightness = palette.map((color) => oklab(color)[0]);
  const light =
    lightness.reduce((sum, value) => sum + value, 0) / lightness.length >= 0.5;
  const anchor = light ? Math.max(...lightness) : Math.min(...lightness);
  // Stay away from pure black and white, which read as frame fills rather than a page.
  const grays = Array.from({ length: 193 }, (_, index) => {
    const level = (index + 32) / 255;
    const color = { r: level, g: level, b: level };
    return {
      color,
      distance: nearestDistance(color, palette),
      offset: Math.abs(oklab(color)[0] - anchor),
    };
  });
  const clear = grays.filter(
    (gray) => gray.distance >= PAGE_BACKGROUND_MIN_DISTANCE,
  );
  const best = clear.length
    ? clear.reduce((a, b) => (b.offset < a.offset ? b : a))
    : grays.reduce((a, b) => (b.distance > a.distance ? b : a));
  return hexColor(best.color);
}
