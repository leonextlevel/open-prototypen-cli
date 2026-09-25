import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import matter from 'gray-matter';
import YAML from 'yaml';
import { z } from 'zod';
import { getDefinition, loadRegistry } from '../../schemas/src/index.js';

const configSchema = z.object({
  version: z.literal(1),
  schema: z.literal('default'),
  language: z.object({
    mode: z.enum(['auto', 'fixed']),
    resolved: z.string().optional(),
    fallback: z.string().default('en'),
  }),
  designEngine: z.literal('openpencil'),
  quality: z
    .object({ nativeDesignSystem: z.boolean().default(false) })
    .default({ nativeDesignSystem: false }),
});
export type ProjectConfig = z.infer<typeof configSchema>;

export function workspace(project: string): string {
  return join(resolve(project), 'docs/design');
}
export function configPath(project: string): string {
  return join(workspace(project), 'config.yaml');
}
export function loadConfig(project: string): ProjectConfig {
  if (!existsSync(configPath(project)))
    throw new Error(
      `Project is not initialized: ${configPath(project)}. Run init first.`,
    );
  return configSchema.parse(
    YAML.parse(readFileSync(configPath(project), 'utf8')),
  );
}
export function resolveProjectLanguage(project: string): string {
  const language = loadConfig(project).language;
  if (language.resolved) return language.resolved;
  if (language.mode === 'auto') {
    const brief = join(workspace(project), 'brief.md');
    if (existsSync(brief)) {
      try {
        const declared = matter(readFileSync(brief, 'utf8')).data.language;
        if (typeof declared === 'string' && declared.trim()) return declared;
      } catch {
        // An invalid brief does not prevent the runtime from using the fallback language.
      }
    }
  }
  return language.fallback;
}
export function artifactPath(project: string, id: string): string {
  return join(workspace(project), getDefinition(id).output);
}
export function dependencyPaths(project: string, id: string): string[] {
  return getDefinition(id).requires.map((dependency) =>
    artifactPath(project, dependency),
  );
}
export function projectSummary(project: string) {
  const config = loadConfig(project);
  return {
    root: resolve(project),
    workspace: workspace(project),
    config,
    artifacts: loadRegistry().artifacts.length,
  };
}
