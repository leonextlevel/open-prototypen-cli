import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { z } from 'zod';

const artifactSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  output: z.string(),
  requires: z.array(z.string()),
  optional: z.boolean().default(false),
  requiredSections: z.array(z.string()).min(1),
  instructions: z.string(),
  rules: z.array(z.string()).default([]),
});
const registrySchema = z.object({
  name: z.literal('default'),
  version: z.literal(1),
  rules: z.array(z.string()).default([]),
  artifacts: z.array(artifactSchema),
});
export type ArtifactDefinition = z.infer<typeof artifactSchema>;

export function packageRoot(): string {
  let path = dirname(fileURLToPath(import.meta.url));
  while (path !== dirname(path)) {
    if (existsSync(join(path, 'packages/schemas/default/schema.yaml')))
      return path;
    path = dirname(path);
  }
  throw new Error('Open Prototypen package assets were not found');
}

export function loadRegistry() {
  const schema = registrySchema.parse(
    YAML.parse(
      readFileSync(
        join(packageRoot(), 'packages/schemas/default/schema.yaml'),
        'utf8',
      ),
    ),
  );
  const ids = new Set(schema.artifacts.map((a) => a.id));
  if (ids.size !== schema.artifacts.length)
    throw new Error('Duplicate artifact ID in schema');
  for (const artifact of schema.artifacts) {
    if (artifact.requires.some((id) => !ids.has(id)))
      throw new Error(`Unknown dependency for ${artifact.id}`);
    const resolved = resolve('/docs/design', artifact.output);
    if (!resolved.startsWith('/docs/design/'))
      throw new Error(`Invalid output path for ${artifact.id}`);
  }
  return schema;
}

export function getDefinition(id: string): ArtifactDefinition {
  const registry = loadRegistry();
  const definition = registry.artifacts.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown artifact: ${id}`);
  return { ...definition, rules: [...registry.rules, ...definition.rules] };
}

export function templateFor(id: string): string {
  getDefinition(id);
  return readFileSync(
    join(packageRoot(), 'packages/schemas/default/templates', `${id}.md`),
    'utf8',
  );
}
