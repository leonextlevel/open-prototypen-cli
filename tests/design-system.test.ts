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
import { systemPath } from '../packages/core/src/system.js';
import { initProject, installSkills } from '../packages/harness/src/index.js';
import {
  evalDocument,
  inspectCanvas,
} from '../packages/openpencil/src/index.js';
import {
  applyDesignSystem,
  importSvg,
  inspectNativeSystem,
} from '../packages/openpencil/src/system.js';
import {
  compilePrototype,
  renderScreens,
} from '../packages/prototype/src/index.js';
import { validateCanvas } from '../packages/validator/src/canvas.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'open-prototypen-v2-'));
  roots.push(root);
  initProject(root, 'codex');
  mkdirSync(join(root, 'docs/design/design'), { recursive: true });
  writeFileSync(
    systemPath(root),
    `version: 1
tokens:
  - name: color.surface
    type: COLOR
    value: '#112233'
  - name: space.md
    type: FLOAT
    value: 12
components:
  - name: BookRow
    states: [default, selected]
    screens: [collection]
`,
  );
  return root;
}

it('creates and synchronizes native variables without replacing unrelated work', async () => {
  const root = fixture();
  const first = await applyDesignSystem(root);
  expect(first.created).toEqual(['color.surface', 'space.md']);
  expect(existsSync(first.document)).toBe(true);
  const initial = inspectNativeSystem(root);
  const colorId = initial.variables.find(
    (variable) => variable.name === 'color.surface',
  )?.id;
  evalDocument(
    root,
    `
    const frame = figma.createFrame(); frame.name = 'User work'; frame.resize(50, 50);
  `,
    true,
  );
  const second = await applyDesignSystem(root);
  expect(second.created).toEqual([]);
  expect(second.updated).toEqual([]);
  expect(second.unchanged).toEqual(['color.surface', 'space.md']);
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8')
      .replace('#112233', '#224466')
      .replace(
        '    value: 12',
        '    value: 12\n  - name: space.lg\n    type: FLOAT\n    value: 24',
      ),
  );
  const third = await applyDesignSystem(root);
  expect(third.updated).toEqual(['color.surface']);
  expect(third.created).toEqual(['space.lg']);
  const after = inspectNativeSystem(root);
  expect(
    after.variables.find((variable) => variable.name === 'color.surface')?.id,
  ).toBe(colorId);
  expect(after.nodes.some((node) => node.name === 'User work')).toBe(true);
}, 20000);

it('imports an SVG as editable vectors and preserves changed installed references', async () => {
  const root = fixture();
  await applyDesignSystem(root);
  const svg = join(root, 'book.svg');
  writeFileSync(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 3h14v18H4z" fill="#112233"/></svg>',
  );
  const imported = importSvg(root, svg, 'book-icon');
  const group = inspectCanvas(root).tree.find(
    (node) => node.id === imported.id,
  );
  expect(group?.children?.some((node) => node.type === 'VECTOR')).toBe(true);
  expect(() => importSvg(root, svg, 'book-icon')).toThrow('already exists');
  const reference = join(
    root,
    '.agents/skills/open-prototypen-design/references/visual-system.md',
  );
  writeFileSync(
    reference,
    readFileSync(reference, 'utf8') + '\nLocal observation.\n',
  );
  expect(installSkills(root, 'codex', true).modified).toContain(
    'codex/open-prototypen-design/references/visual-system.md',
  );
  expect(readFileSync(reference, 'utf8')).toContain('Local observation.');
}, 20000);

it('requires manifest components, bound tokens, and linked screen instances before compiling', async () => {
  const root = fixture();
  await applyDesignSystem(root);
  const missing = validateCanvas(root, { collection: 'unknown' });
  expect(missing.valid).toBe(false);
  expect(
    missing.findings.some((finding) => finding.code === 'token-unbound'),
  ).toBe(true);
  evalDocument(
    root,
    `
    const color = figma.getLocalVariables().find((item) => item.name === 'color.surface');
    const spacing = figma.getLocalVariables().find((item) => item.name === 'space.md');
    const frame = figma.createFrame(); frame.name = 'collection'; frame.resize(390, 760);
    const row = figma.createComponent(); row.name = 'BookRow/default'; row.resize(300, 80);
    row.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1 }];
    row.layoutMode = 'VERTICAL'; row.itemSpacing = 12;
    figma.bindVariable(row.id, 'fills/0/color', color.id);
    figma.bindVariable(row.id, 'itemSpacing', spacing.id);
    const selected = figma.createComponent(); selected.name = 'BookRow/selected'; selected.resize(300, 80);
    const instance = row.createInstance(); frame.appendChild(instance); instance.x = 20; instance.y = 100;
  `,
    true,
  );
  const frame = inspectCanvas(root).tree.find(
    (node) => node.name === 'collection',
  );
  expect(frame).toBeTruthy();
  if (!frame) return;
  const validation = validateCanvas(root, { collection: frame.id });
  expect(validation).toMatchObject({
    valid: true,
    summary: { tokens: 2, boundTokens: 2, components: 2, instances: 1 },
  });
  writeFileSync(
    join(root, 'docs/design/prototype/interactions.yaml'),
    `version: 1\ninitialScreen: collection\nscreens:\n  collection:\n    frame: '${frame.id}'\n    title: Coleção\n    content: Uma coleção de livros.\n    actions: {}\n`,
  );
  renderScreens(root);
  expect(compilePrototype(root).screens).toBe(1);
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8').replace(
      'selected]',
      'selected, disabled]',
    ),
  );
  expect(
    validateCanvas(root, { collection: frame.id }).findings.some(
      (finding) => finding.code === 'component-state',
    ),
  ).toBe(true);
  expect(() => compilePrototype(root)).toThrow(
    'Native design system is invalid',
  );
}, 20000);
