import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import {
  artifactPath,
  resolveProjectLanguage,
} from '../packages/core/src/index.js';
import { initProject, installSkills } from '../packages/harness/src/index.js';
import { templateFor } from '../packages/schemas/src/index.js';
import { status, validateArtifact } from '../packages/validator/src/index.js';

const projects: string[] = [];
function project() {
  const path = mkdtempSync(join(tmpdir(), 'open-prototypen-test-'));
  projects.push(path);
  initProject(path, 'codex', 'pt-BR');
  return path;
}
function put(projectPath: string, id: string, complete = true) {
  const path = artifactPath(projectPath, id);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    complete
      ? templateFor(id).replace(
          /^TODO: (?!Optional).*$/gm,
          'Conteúdo fundamentado para esta seção.',
        )
      : templateFor(id),
  );
}
afterEach(() => {
  for (const path of projects.splice(0))
    rmSync(path, { recursive: true, force: true });
});

describe('artifact workflow', () => {
  it('recognizes incomplete templates and dependency readiness', () => {
    const root = project();
    expect(status(root).find((item) => item.artifact === 'brief')?.state).toBe(
      'ready',
    );
    put(root, 'brief', false);
    expect(
      validateArtifact(root, 'brief').findings.some(
        (finding) => finding.code === 'section-empty',
      ),
    ).toBe(true);
    expect(status(root).find((item) => item.artifact === 'brief')?.state).toBe(
      'draft',
    );
    put(root, 'brief');
    expect(
      status(root).find((item) => item.artifact === 'market-research')?.state,
    ).toBe('ready');
    put(root, 'market-research');
    put(root, 'product-definition');
    expect(validateArtifact(root, 'product-definition').valid).toBe(true);
    put(root, 'brief', false);
    expect(
      validateArtifact(root, 'product-definition').findings.some(
        (finding) => finding.code === 'dependency',
      ),
    ).toBe(true);
    expect(
      status(root).find((item) => item.artifact === 'product-definition')
        ?.state,
    ).toBe('invalid');
  });

  it('requires a filled state table in the screen map but not rule coverage', () => {
    const root = project();
    const template = templateFor('screen-map');
    expect(template).toContain('Screen key');
    expect(template).toContain('## Rule Coverage');
    put(root, 'screen-map', false);
    expect(
      validateArtifact(root, 'screen-map', false).findings.map(
        (finding) => finding.message,
      ),
    ).toContain('Empty section: States');
    put(root, 'screen-map');
    expect(validateArtifact(root, 'screen-map', false).findings).toEqual([]);
    expect(templateFor('product-definition')).toMatch(/stable ID/);
  });

  it('flags an audit report older than the files it describes', () => {
    const root = project();
    put(root, 'audit-report');
    const report = artifactPath(root, 'audit-report');
    const system = join(root, 'docs/design/design/system.yaml');
    const figure = join(root, 'docs/design/prototype/prototype.fig');
    mkdirSync(join(figure, '..'), { recursive: true });
    mkdirSync(join(system, '..'), { recursive: true });
    writeFileSync(system, 'version: 1\n');
    writeFileSync(figure, '');
    const audit = () =>
      status(root).find((item) => item.artifact === 'audit-report')?.warnings ??
      [];
    const at = (path: string, seconds: number) =>
      utimesSync(path, seconds, seconds);
    at(system, 1000);
    at(figure, 1000);
    at(report, 2000);
    expect(audit()).toEqual([]);
    at(figure, 3000);
    expect(audit()).toEqual([
      {
        code: 'audit-stale',
        message:
          'The audit report is older than prototype/prototype.fig; re-check the changed prototype and update the report',
      },
    ]);
    expect(
      status(root).find((item) => item.artifact === 'brief')?.warnings,
    ).toEqual([]);
  });

  it('accepts audit reports with and without the optional tables', () => {
    const root = project();
    const path = artifactPath(root, 'audit-report');
    mkdirSync(join(path, '..'), { recursive: true });
    const report = templateFor('audit-report').replace(
      /^TODO: (?!Optional).*$/gm,
      'Achado fundamentado nesta seção.',
    );
    expect(report).toContain('## Error Recovery');
    expect(report).toContain('## Resolution');
    writeFileSync(path, report);
    expect(validateArtifact(root, 'audit-report', false).findings).toEqual([]);
    writeFileSync(
      path,
      report
        .replace(/\n## Error Recovery\n[\s\S]*?(?=\n## )/, '')
        .replace(/\n## Resolution\n[\s\S]*$/, '\n'),
    );
    expect(readFileSync(path, 'utf8')).not.toContain('## Resolution');
    expect(validateArtifact(root, 'audit-report', false).findings).toEqual([]);
  });

  it('preserves a locally edited installed skill during update', () => {
    const root = project();
    const path = join(root, '.agents/skills/open-prototypen/SKILL.md');
    writeFileSync(path, readFileSync(path, 'utf8') + '\nLocal note.\n');
    const result = installSkills(root, 'codex', true);
    expect(result.modified).toContain('codex/open-prototypen');
    expect(readFileSync(path, 'utf8')).toContain('Local note.');
  });

  it('uses an artifact language when project language is automatic', () => {
    const root = mkdtempSync(join(tmpdir(), 'open-prototypen-language-'));
    projects.push(root);
    initProject(root, 'codex');
    expect(resolveProjectLanguage(root)).toBe('en');
    const brief = artifactPath(root, 'brief');
    writeFileSync(
      brief,
      templateFor('brief').replace('language: en', 'language: pt-BR'),
    );
    expect(resolveProjectLanguage(root)).toBe('pt-BR');
  });
});
