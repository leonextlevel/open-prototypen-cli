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
  })
  .superRefine((system, context) => {
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
