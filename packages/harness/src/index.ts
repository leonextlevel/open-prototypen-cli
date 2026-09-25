import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import YAML from 'yaml';
import { configPath, workspace } from '../../core/src/index.js';
import { packageRoot } from '../../schemas/src/index.js';

const skillNames = [
  'open-prototypen',
  'open-prototypen-explore',
  'open-prototypen-research',
  'open-prototypen-define',
  'open-prototypen-design',
  'open-prototypen-audit',
  'open-prototypen-refine',
];
type Harness = 'codex' | 'claude';
type Manifest = {
  version: 1;
  toolVersion?: string;
  skills: Record<string, string>;
};
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const manifestPath = (project: string) =>
  join(workspace(project), '.installation.json');
function readManifest(project: string): Manifest {
  const path = manifestPath(project);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as Manifest)
    : { version: 1, skills: {} };
}
function selectedHarnesses(
  project: string,
  requested: string | undefined,
  existingOnly = false,
): Harness[] {
  if (requested) {
    if (requested === 'all') return ['codex', 'claude'];
    if (requested === 'codex' || requested === 'claude') return [requested];
    throw new Error('Harness must be codex, claude, or all');
  }
  const detected: Harness[] = [];
  if (
    existsSync(join(project, '.agents')) ||
    existsSync(join(project, 'AGENTS.md'))
  )
    detected.push('codex');
  if (existsSync(join(project, '.claude'))) detected.push('claude');
  if (detected.length) return detected;
  if (existingOnly) return [];
  throw new Error('No harness detected. Pass --harness codex, claude, or all.');
}
function skillPath(
  project: string,
  harness: Harness,
  name: string,
  file = 'SKILL.md',
): string {
  return join(
    project,
    harness === 'codex' ? '.agents/skills' : '.claude/skills',
    name,
    file,
  );
}
function sourceFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = join(prefix, entry.name);
    return entry.isDirectory()
      ? sourceFiles(join(directory, entry.name), relative)
      : entry.isFile()
        ? [relative]
        : [];
  });
}
export function installSkills(
  project: string,
  requested?: string,
  update = false,
) {
  const manifest = readManifest(project);
  const harnesses = selectedHarnesses(project, requested, update);
  if (!harnesses.length)
    throw new Error('No installed harness found. Pass --harness.');
  const installed: string[] = [],
    unchanged: string[] = [],
    modified: string[] = [];
  for (const harness of harnesses)
    for (const name of skillNames)
      for (const file of sourceFiles(join(packageRoot(), 'skills', name))) {
        const source = readFileSync(
          join(packageRoot(), 'skills', name, file),
          'utf8',
        );
        const target = skillPath(project, harness, name, file);
        const key =
          file === 'SKILL.md'
            ? `${harness}/${name}`
            : `${harness}/${name}/${file}`;
        if (existsSync(target)) {
          const current = readFileSync(target, 'utf8');
          if (current === source) {
            manifest.skills[key] = digest(current);
            unchanged.push(key);
            continue;
          }
          if (
            !manifest.skills[key] ||
            manifest.skills[key] !== digest(current)
          ) {
            modified.push(key);
            continue;
          }
        }
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, source);
        manifest.skills[key] = digest(source);
        installed.push(key);
      }
  mkdirSync(dirname(manifestPath(project)), { recursive: true });
  manifest.toolVersion = (
    JSON.parse(readFileSync(join(packageRoot(), 'package.json'), 'utf8')) as {
      version: string;
    }
  ).version;
  writeFileSync(
    manifestPath(project),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  return { installed, unchanged, modified };
}
export function initProject(
  project: string,
  requested?: string,
  language?: string,
) {
  selectedHarnesses(project, requested);
  const path = configPath(project);
  mkdirSync(workspace(project), { recursive: true });
  if (!existsSync(path)) {
    writeFileSync(
      path,
      YAML.stringify({
        version: 1,
        schema: 'default',
        language: language
          ? { mode: 'fixed', resolved: language, fallback: 'en' }
          : { mode: 'auto', fallback: 'en' },
        designEngine: 'openpencil',
        quality: { nativeDesignSystem: true },
      }),
    );
  }
  return { config: path, ...installSkills(project, requested) };
}
