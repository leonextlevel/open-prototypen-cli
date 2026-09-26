import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { packageRoot } from '../packages/schemas/src/index.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function cli(root: string, ...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      join(packageRoot(), 'bin/open-prototypen.mjs'),
      '--project',
      root,
      ...args,
    ],
    { encoding: 'utf8' },
  );
}

it('initializes both harnesses and serves artifact contracts through the CLI', () => {
  const root = mkdtempSync(join(tmpdir(), 'open-prototypen-cli-'));
  roots.push(root);
  const initialized = cli(
    root,
    'init',
    '--harness',
    'all',
    '--language',
    'pt-BR',
  );
  expect(initialized.status).toBe(0);
  expect(
    existsSync(join(root, '.agents/skills/open-prototypen/SKILL.md')),
  ).toBe(true);
  expect(
    existsSync(join(root, '.claude/skills/open-prototypen/SKILL.md')),
  ).toBe(true);
  expect(
    existsSync(
      join(root, '.agents/skills/open-prototypen-component-review/SKILL.md'),
    ),
  ).toBe(true);
  expect(
    existsSync(
      join(root, '.claude/skills/open-prototypen-component-review/SKILL.md'),
    ),
  ).toBe(true);
  expect(
    existsSync(
      join(
        root,
        '.agents/skills/open-prototypen-design/references/design-system.md',
      ),
    ),
  ).toBe(true);
  const contract = JSON.parse(
    cli(root, 'instructions', 'brief', '--json').stdout,
  );
  expect(contract.outputPath).toBe('docs/design/brief.md');
  expect(contract.rules.length).toBeGreaterThan(0);
  expect(contract.template).toContain('language: pt-BR');
  const path = join(root, contract.outputPath);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    contract.template.replaceAll(
      'TODO: Replace with researched or reasoned content.',
      'Conteúdo criado após investigação.',
    ),
  );
  expect(cli(root, 'validate', 'brief', '--json').status).toBe(0);
  const states = JSON.parse(cli(root, 'status', '--json').stdout);
  expect(
    states.find(
      (item: { artifact: string }) => item.artifact === 'market-research',
    ).state,
  ).toBe('ready');
  const inspection = JSON.parse(
    cli(root, 'inspect', 'project', '--json').stdout,
  );
  expect(inspection.config.language.resolved).toBe('pt-BR');
  expect(inspection.config.quality.nativeDesignSystem).toBe(true);
  const missingCanvas = cli(root, 'validate', 'canvas', '--json');
  expect(missingCanvas.status).toBe(1);
  expect(JSON.parse(missingCanvas.stdout).findings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'system-manifest' }),
      expect.objectContaining({ code: 'interactions' }),
    ]),
  );
  mkdirSync(join(root, 'docs/design/design'), { recursive: true });
  writeFileSync(
    join(root, 'docs/design/design/system.yaml'),
    "version: 1\ntokens:\n  - name: color.surface\n    type: COLOR\n    value: '#112233'\ncomponents:\n  - name: BookRow\n    states: [default]\n    screens: [collection]\n",
  );
  const applied = cli(root, 'system', 'apply', '--json');
  expect(applied.status).toBe(0);
  expect(JSON.parse(applied.stdout).created).toEqual(['color.surface']);
  expect(JSON.parse(cli(root, 'ref', 'list', '--json').stdout)).toMatchObject({
    refs: [],
    problems: [],
  });
  const invalidRef = cli(root, 'ref', 'set', '0:1=Invalid Ref', '--json');
  expect(invalidRef.status).toBe(1);
  expect(JSON.parse(invalidRef.stdout).error).toContain(
    'expected <node-id>=<ref>',
  );
  expect(cli(root, 'ref', 'set', '0:1=Invalid Ref').stderr).toContain(
    'Error: Invalid assignment',
  );
  expect(
    JSON.parse(cli(root, 'inspect', 'system', '--json').stdout).native
      .variables,
  ).toHaveLength(1);
  expect(cli(root, 'update', '--harness', 'all').status).toBe(0);
  expect(readFileSync(path, 'utf8')).toContain('Conteúdo criado');
}, 60000);
