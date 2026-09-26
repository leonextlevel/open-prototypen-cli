import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import matter from 'gray-matter';
import type { Content, Heading, PhrasingContent } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { artifactPath, loadConfig, workspace } from '../../core/src/index.js';
import { readDesignSystem } from '../../core/src/system.js';
import { getDefinition, loadRegistry } from '../../schemas/src/index.js';

export type Finding = { code: string; message: string };
export type ArtifactResult = {
  artifact: string;
  path: string;
  exists: boolean;
  valid: boolean;
  findings: Finding[];
};
export type ArtifactState = ArtifactResult & {
  state: 'valid' | 'invalid' | 'draft' | 'ready' | 'blocked' | 'optional';
  blockedBy: string[];
  // Warnings do not change the state.
  warnings: Finding[];
};

// Files the audit describes, relative to the workspace.
const AUDITED_FILES = [
  'prototype/prototype.fig',
  'design/system.yaml',
  'prototype/interactions.yaml',
];
// Modification times follow checkouts and copies, so this is a hint rather than proof.
function auditWarnings(project: string, report: string): Finding[] {
  const audited = statSync(report).mtimeMs;
  const newer = AUDITED_FILES.filter((file) => {
    const path = join(workspace(project), file);
    return existsSync(path) && statSync(path).mtimeMs > audited;
  });
  return newer.length
    ? [
        {
          code: 'audit-stale',
          message: `The audit report is older than ${newer.join(', ')}; re-check the changed prototype and update the report`,
        },
      ]
    : [];
}

function headingText(node: Heading): string {
  const text = (children: PhrasingContent[]): string =>
    children
      .map((child) => {
        if ('value' in child && typeof child.value === 'string')
          return child.value;
        if ('children' in child)
          return text(child.children as PhrasingContent[]);
        return '';
      })
      .join('');
  return text(node.children).trim();
}
function meaningful(nodes: Content[]): boolean {
  const extract = (node: unknown): string => {
    if (!node || typeof node !== 'object') return '';
    const item = node as {
      value?: unknown;
      children?: unknown[];
      type?: string;
    };
    if (item.type === 'html' || item.type === 'heading') return '';
    if (typeof item.value === 'string') return item.value;
    return item.children?.map(extract).join(' ') ?? '';
  };
  const value = nodes.map(extract).join(' ').trim();
  return (
    !!value && !/^(TODO(?::.*)?|TBD|\.\.\.|Write here\.?|N\/A)$/i.test(value)
  );
}

export function validateArtifact(
  project: string,
  id: string,
  checkDependencies = true,
): ArtifactResult {
  loadConfig(project);
  const definition = getDefinition(id);
  const path = artifactPath(project, id);
  const findings: Finding[] = [];
  if (!existsSync(path))
    return {
      artifact: id,
      path: relative(project, path),
      exists: false,
      valid: false,
      findings: [{ code: 'missing', message: 'Artifact does not exist' }],
    };
  const raw = readFileSync(path, 'utf8');
  if (!raw.startsWith('---\n'))
    findings.push({
      code: 'frontmatter',
      message: 'YAML frontmatter is required',
    });
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(raw);
  } catch (error) {
    return {
      artifact: id,
      path: relative(project, path),
      exists: true,
      valid: false,
      findings: [{ code: 'frontmatter', message: String(error) }],
    };
  }
  const metadata = parsed.data;
  if (metadata.artifact !== id)
    findings.push({ code: 'artifact', message: `Expected artifact: ${id}` });
  if (metadata.version !== 1)
    findings.push({ code: 'version', message: 'Expected template version 1' });
  if (!['draft', 'reviewed', 'approved'].includes(metadata.status))
    findings.push({
      code: 'status',
      message: 'Expected status draft, reviewed, or approved',
    });
  if (typeof metadata.language !== 'string' || !metadata.language.trim())
    findings.push({ code: 'language', message: 'A language is required' });
  if (
    metadata.dependsOn !== undefined &&
    (!Array.isArray(metadata.dependsOn) ||
      metadata.dependsOn.join('|') !== definition.requires.join('|'))
  )
    findings.push({
      code: 'dependsOn',
      message: `Expected dependencies: ${definition.requires.join(', ')}`,
    });
  const tree = unified().use(remarkParse).parse(parsed.content);
  const sections = new Map<string, Content[][]>();
  let current: string | undefined;
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 2) {
      current = headingText(node);
      sections.set(current, [...(sections.get(current) ?? []), []]);
    } else if (current) sections.get(current)?.at(-1)?.push(node);
  }
  for (const heading of definition.requiredSections) {
    const matches = sections.get(heading) ?? [];
    if (!matches.length)
      findings.push({
        code: 'section-missing',
        message: `Missing section: ${heading}`,
      });
    else if (matches.length > 1)
      findings.push({
        code: 'section-duplicate',
        message: `Duplicate section: ${heading}`,
      });
    else if (!meaningful(matches[0] ?? []))
      findings.push({
        code: 'section-empty',
        message: `Empty section: ${heading}`,
      });
  }
  if (
    id === 'design-system' &&
    loadConfig(project).quality.nativeDesignSystem
  ) {
    try {
      readDesignSystem(project);
    } catch (error) {
      findings.push({
        code: 'system-manifest',
        message: `Invalid design/system.yaml: ${String(error)}`,
      });
    }
  }
  if (checkDependencies)
    for (const dependency of definition.requires) {
      const result = validateArtifact(project, dependency, true);
      if (!result.valid)
        findings.push({
          code: 'dependency',
          message: `Dependency is not valid: ${dependency}`,
        });
    }
  return {
    artifact: id,
    path: relative(project, path),
    exists: true,
    valid: findings.length === 0,
    findings,
  };
}

export function status(project: string): ArtifactState[] {
  loadConfig(project);
  const registry = loadRegistry();
  const cache = new Map<string, ArtifactState>();
  const resolveState = (id: string): ArtifactState => {
    const cached = cache.get(id);
    if (cached) return cached;
    const definition = getDefinition(id);
    const result = validateArtifact(project, id, false);
    const blockedBy = definition.requires.filter(
      (dependency) => resolveState(dependency).state !== 'valid',
    );
    if (result.exists && blockedBy.length) {
      result.findings.push({
        code: 'dependency',
        message: `Invalid dependencies: ${blockedBy.join(', ')}`,
      });
      result.valid = false;
    }
    let state: ArtifactState['state'];
    if (result.exists)
      state = result.valid
        ? 'valid'
        : result.findings.every((f) => f.code === 'section-empty')
          ? 'draft'
          : 'invalid';
    else
      state = definition.optional
        ? 'optional'
        : blockedBy.length
          ? 'blocked'
          : 'ready';
    const warnings =
      id === 'audit-report' && result.exists
        ? auditWarnings(project, artifactPath(project, id))
        : [];
    const entry = { ...result, state, blockedBy, warnings };
    cache.set(id, entry);
    return entry;
  };
  return registry.artifacts.map((artifact) => resolveState(artifact.id));
}
