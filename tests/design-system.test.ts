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
  relativeBounds,
  renderFrame,
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
  const review = join(
    root,
    '.agents/skills/open-prototypen-component-review/SKILL.md',
  );
  writeFileSync(
    reference,
    readFileSync(reference, 'utf8') + '\nLocal observation.\n',
  );
  writeFileSync(
    review,
    readFileSync(review, 'utf8') + '\nLocal review note.\n',
  );
  const updated = installSkills(root, 'codex', true);
  expect(updated.modified).toContain(
    'codex/open-prototypen-design/references/visual-system.md',
  );
  expect(updated.modified).toContain('codex/open-prototypen-component-review');
  expect(readFileSync(reference, 'utf8')).toContain('Local observation.');
  expect(readFileSync(review, 'utf8')).toContain('Local review note.');
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

it('inspects, renders, and compiles screens across flow pages', async () => {
  const root = fixture();
  await applyDesignSystem(root);
  evalDocument(
    root,
    `
    const collection = figma.currentPage;
    collection.name = 'Flow: Collection';
    const detail = figma.createPage(); detail.name = 'Flow: Detail';
    const shared = figma.createPage(); shared.name = 'Shared';
    const system = figma.createPage(); system.name = 'Design System';
    figma.currentPage = system;
    const samples = figma.createFrame(); samples.name = 'Color, type, and spacing samples'; samples.resize(320, 240);
    samples.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 }];
    const swatch = figma.createRectangle(); swatch.name = 'color.surface'; swatch.resize(80, 80); samples.appendChild(swatch);
    const type = figma.createText(); type.name = 'Body type'; type.characters = 'Sample text'; type.y = 100; samples.appendChild(type);
    const rhythm = figma.createRectangle(); rhythm.name = 'space.md'; rhythm.resize(12, 12); rhythm.y = 160;
    rhythm.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1 }];
    samples.appendChild(rhythm);
    const color = figma.getLocalVariables().find((item) => item.name === 'color.surface');
    const spacing = figma.getLocalVariables().find((item) => item.name === 'space.md');
    const component = figma.createComponent(); component.name = 'BookRow/default'; component.resize(100, 40);
    component.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1 }];
    component.layoutMode = 'VERTICAL'; component.itemSpacing = 12;
    figma.bindVariable(component.id, 'fills/0/color', color.id);
    figma.bindVariable(component.id, 'itemSpacing', spacing.id);
    swatch.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1 }];
    figma.bindVariable(swatch.id, 'fills/0/color', color.id);
    const selected = figma.createComponent(); selected.name = 'BookRow/selected'; selected.resize(100, 40);
    figma.currentPage = collection;
    const collectionFrame = figma.createFrame(); collectionFrame.name = 'collection'; collectionFrame.resize(200, 160);
    const instance = component.createInstance(); collectionFrame.appendChild(instance); instance.x = 20; instance.y = 30;
    const action = figma.createRectangle(); action.name = 'open-detail'; action.resize(40, 30);
    collectionFrame.appendChild(action); action.x = 30; action.y = 90;
    figma.currentPage = detail;
    const detailFrame = figma.createFrame(); detailFrame.name = 'detail'; detailFrame.resize(200, 160);
    figma.currentPage = shared;
    const sharedFrame = figma.createFrame(); sharedFrame.name = 'shared'; sharedFrame.resize(200, 160);
  `,
    true,
  );
  const canvas = inspectCanvas(root);
  const collection = canvas.tree.find((node) => node.name === 'collection');
  const detail = canvas.tree.find((node) => node.name === 'detail');
  const shared = canvas.tree.find((node) => node.name === 'shared');
  const action = collection?.children?.find(
    (node) => node.name === 'open-detail',
  );
  const ids = {
    collection: collection?.id ?? '',
    detail: detail?.id ?? '',
    shared: shared?.id ?? '',
    action: action?.id ?? '',
  };
  expect(
    (canvas.pages as unknown[]).map(
      (page: unknown) => (page as { name: string }).name,
    ),
  ).toEqual(['Flow: Collection', 'Flow: Detail', 'Shared', 'Design System']);
  expect(canvas.tree.map((node) => node.name)).toContain('detail');
  const samples = canvas.tree.find(
    (node) => node.name === 'Color, type, and spacing samples',
  );
  expect(samples?.children?.map((node) => node.name)).toEqual([
    'color.surface',
    'Body type',
    'space.md',
  ]);
  expect(samples).toBeTruthy();
  if (samples) {
    const sampleImage = join(root, 'samples.png');
    renderFrame(root, samples.id, sampleImage);
    expect(existsSync(sampleImage)).toBe(true);
  }
  expect(relativeBounds(canvas.tree, ids.collection, ids.action)).toMatchObject(
    { x: 30, y: 90 },
  );
  expect(validateCanvas(root, { collection: ids.collection }).valid).toBe(true);
  const native = inspectNativeSystem(root);
  const component = native.nodes.find(
    (node) => node.type === 'COMPONENT' && node.name === 'BookRow/default',
  );
  const systemPage = (canvas.pages as { id: string; name: string }[]).find(
    (page) => page.name === 'Design System',
  );
  expect(native.nodes.find((node) => node.id === samples?.id)?.parentId).toBe(
    systemPage?.id,
  );
  expect(native.nodes.filter((node) => node.type === 'COMPONENT')).toHaveLength(
    2,
  );
  expect(
    native.nodes
      .filter((node) => node.type === 'COMPONENT')
      .every((node) => node.parentId === systemPage?.id),
  ).toBe(true);
  const instance = native.nodes.find((node) => node.type === 'INSTANCE');
  expect(instance?.componentId).toBe(component?.id);
  writeFileSync(
    join(root, 'docs/design/prototype/interactions.yaml'),
    `version: 1\ninitialScreen: collection\nscreens:\n  collection:\n    frame: '${ids.collection}'\n    title: Collection\n    content: Book list.\n    actions:\n      open-detail:\n        node: '${ids.action}'\n        label: Open detail\n        action: navigate\n        target: detail\n  detail:\n    frame: '${ids.detail}'\n    title: Detail\n    content: Book detail.\n  shared:\n    frame: '${ids.shared}'\n    title: Shared\n    content: Shared screen.\n`,
  );
  expect(renderScreens(root)).toHaveLength(3);
  expect(compilePrototype(root).screens).toBe(3);
}, 30000);
