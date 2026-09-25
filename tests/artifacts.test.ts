import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
      ? templateFor(id).replaceAll(
          'TODO: Replace with researched or reasoned content.',
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
