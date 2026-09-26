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
import { inflateSync } from 'node:zlib';
import { afterEach, expect, it } from 'vitest';
import {
  pageBackground,
  readDesignSystem,
  systemPath,
} from '../packages/core/src/system.js';
import { initProject, installSkills } from '../packages/harness/src/index.js';
import {
  evalDocument,
  figPath,
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
  pageRenderPath,
  renderPages,
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
}, 60000);

it('reports and prunes native variables that system.yaml no longer declares', async () => {
  const root = fixture();
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8').replace(
      'tokens:',
      "tokens:\n  - name: color.scrim\n    type: COLOR\n    value: '#00000080'\n  - name: color.accent\n    type: COLOR\n    value: '#aa3300'",
    ),
  );
  await applyDesignSystem(root);
  evalDocument(
    root,
    `
    const accent = figma.getLocalVariables().find((item) => item.name === 'color.accent');
    const box = figma.createRectangle(); box.name = 'accent-box'; box.resize(20, 20);
    box.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.2, b: 0, a: 1 }, opacity: 1 }];
    figma.bindVariable(box.id, 'fills/0/color', accent.id);
  `,
    true,
  );
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8').replace(
      /  - name: color\.scrim[\s\S]*?'#aa3300'\n/,
      '',
    ),
  );
  const report = await applyDesignSystem(root);
  expect(report.extra).toEqual(['color.scrim', 'color.accent']);
  expect(report.pruned).toEqual([]);
  expect(
    validateCanvas(root, {})
      .warnings.filter((warning) => warning.code === 'token-undeclared')
      .map((warning) => warning.message),
  ).toEqual([
    expect.stringContaining('color.scrim is not in system.yaml'),
    expect.stringContaining('color.accent is not in system.yaml'),
  ]);
  await expect(applyDesignSystem(root, { prune: true })).rejects.toThrow(
    'Cannot prune bound variables: color.accent (1 nodes)',
  );
  expect(
    inspectNativeSystem(root).variables.map((variable) => variable.name),
  ).toContain('color.scrim');
  const forced = await applyDesignSystem(root, { prune: true, force: true });
  expect(forced.pruned).toEqual(['color.scrim', 'color.accent']);
  const after = inspectNativeSystem(root);
  expect(after.variables.map((variable) => variable.name)).toEqual([
    'color.surface',
    'space.md',
  ]);
  expect(
    after.nodes.find((node) => node.name === 'accent-box')?.boundVariables,
  ).toEqual({});
  expect((await applyDesignSystem(root, { prune: true })).extra).toEqual([]);
}, 60000);

it('prunes an unbound variable without --force', async () => {
  const root = fixture();
  await applyDesignSystem(root);
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8').replace(
      /  - name: space\.md[\s\S]*?value: 12\n/,
      '',
    ),
  );
  expect(await applyDesignSystem(root, { prune: true })).toMatchObject({
    extra: ['space.md'],
    pruned: ['space.md'],
  });
  expect(
    inspectNativeSystem(root).variables.map((variable) => variable.name),
  ).toEqual(['color.surface']);
}, 60000);

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
}, 60000);

it('keeps round stroke caps and joins of imported SVG icons after saving', async () => {
  const root = fixture();
  await applyDesignSystem(root);
  const svg = join(root, 'check.svg');
  writeFileSync(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  );
  importSvg(root, svg, 'check-icon');
  const strokes = evalDocument(
    root,
    `return [...figma.graph.getAllNodes()]
      .filter((node) => node.type === 'VECTOR')
      .map((node) => [node.strokeCap, node.strokeJoin]);`,
  );
  expect(strokes).toEqual([['ROUND', 'ROUND']]);
}, 60000);

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
  expect(validation.warnings).toEqual([
    expect.objectContaining({ code: 'design-system-page' }),
    expect.objectContaining({
      code: 'component-unused',
      message: 'Component master BookRow/selected has no linked instance',
    }),
  ]);
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
}, 60000);

it('counts components nested inside other component instances as screen usage', async () => {
  const root = fixture();
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8').replace(
      'components:',
      'components:\n  - name: Badge\n    states: [active]\n    screens: [collection]',
    ),
  );
  await applyDesignSystem(root);
  evalDocument(
    root,
    `
    const color = figma.getLocalVariables().find((item) => item.name === 'color.surface');
    const spacing = figma.getLocalVariables().find((item) => item.name === 'space.md');
    const badge = figma.createComponent(); badge.name = 'Badge/active'; badge.resize(40, 20);
    const row = figma.createComponent(); row.name = 'BookRow/default'; row.resize(300, 80);
    row.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1 }];
    row.layoutMode = 'VERTICAL'; row.itemSpacing = 12;
    figma.bindVariable(row.id, 'fills/0/color', color.id);
    figma.bindVariable(row.id, 'itemSpacing', spacing.id);
    row.appendChild(badge.createInstance());
    const selected = figma.createComponent(); selected.name = 'BookRow/selected'; selected.resize(300, 80);
    const frame = figma.createFrame(); frame.name = 'collection'; frame.resize(390, 760);
    frame.appendChild(row.createInstance());
  `,
    true,
  );
  const frame = inspectCanvas(root).tree.find(
    (node) => node.name === 'collection',
  );
  expect(validateCanvas(root, { collection: frame?.id ?? '' })).toMatchObject({
    valid: true,
    findings: [],
  });
}, 60000);

it('warns about instances on undeclared screens and unused masters', async () => {
  const root = fixture();
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8').replace(
      'components:',
      'components:\n  - name: Badge\n    states: [active]\n  - name: Card\n    states: [default]',
    ),
  );
  await applyDesignSystem(root);
  evalDocument(
    root,
    `
    const badge = figma.createComponent(); badge.name = 'Badge/active'; badge.resize(40, 20);
    const row = figma.createComponent(); row.name = 'BookRow/default'; row.resize(300, 80);
    row.appendChild(badge.createInstance());
    const selected = figma.createComponent(); selected.name = 'BookRow/selected'; selected.resize(300, 80);
    const card = figma.createComponent(); card.name = 'Card/default'; card.resize(300, 80);
    const collection = figma.createFrame(); collection.name = 'collection'; collection.resize(390, 760);
    collection.appendChild(row.createInstance());
    const settings = figma.createFrame(); settings.name = 'settings'; settings.resize(390, 760);
    settings.appendChild(row.createInstance());
    settings.appendChild(selected.createInstance());
  `,
    true,
  );
  const tree = inspectCanvas(root).tree;
  const frame = (name: string) =>
    tree.find((node) => node.name === name)?.id ?? '';
  const warnings = validateCanvas(root, {
    collection: frame('collection'),
    settings: frame('settings'),
  }).warnings.filter((warning) => warning.code.startsWith('component-'));
  // BookRow is used directly on settings; Badge only through the nested instance in BookRow.
  // Badge/active is used only inside another master, which counts as use.
  expect(warnings.map((warning) => warning.message)).toEqual([
    'Component Badge appears on screen collection, which its screens in system.yaml do not list',
    'Component BookRow appears on screen settings, which its screens in system.yaml do not list',
    'Component Badge appears on screen settings, which its screens in system.yaml do not list',
    'Component master Card/default has no linked instance',
  ]);
}, 60000);

it('warns about tokens bound only to Design System samples', async () => {
  const root = fixture();
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8').replace(
      'tokens:',
      "tokens:\n  - name: color.text\n    type: COLOR\n    value: '#000000'\n  - name: color.border\n    type: COLOR\n    value: '#cccccc'",
    ),
  );
  await applyDesignSystem(root);
  evalDocument(
    root,
    `
    const variable = (name) => figma.getLocalVariables().find((item) => item.name === name);
    const paint = { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1 };
    const flow = figma.currentPage;
    const screen = figma.createFrame(); screen.name = 'collection'; screen.resize(390, 760);
    const label = figma.createRectangle(); label.fills = [paint]; screen.appendChild(label);
    figma.bindVariable(label.id, 'fills/0/color', variable('color.text').id);
    const system = figma.createPage(); system.name = 'Design System';
    figma.currentPage = system;
    const row = figma.createComponent(); row.name = 'BookRow/default'; row.fills = [paint];
    figma.bindVariable(row.id, 'fills/0/color', variable('color.surface').id);
    const divider = figma.createRectangle(); divider.fills = [paint]; row.appendChild(divider);
    figma.bindVariable(divider.id, 'fills/0/color', variable('color.border').id);
    const sample = figma.createFrame(); sample.name = 'spacing sample';
    sample.layoutMode = 'HORIZONTAL'; sample.itemSpacing = 12;
    figma.bindVariable(sample.id, 'itemSpacing', variable('space.md').id);
    const swatch = figma.createRectangle(); swatch.fills = [paint];
    figma.bindVariable(swatch.id, 'fills/0/color', variable('color.text').id);
  `,
    true,
  );
  expect(
    validateCanvas(root, {})
      .warnings.filter((warning) => warning.code === 'token-sample-only')
      .map((warning) => warning.message),
  ).toEqual([
    'Native variable space.md is bound only to samples on Design System; bind it in component masters or screens too',
  ]);
}, 60000);

it('warns about text that repeats a master name on the Design System page', async () => {
  const root = fixture();
  await applyDesignSystem(root);
  evalDocument(
    root,
    `
    const flow = figma.currentPage;
    const system = figma.createPage(); system.name = 'Design System';
    figma.currentPage = system;
    const text = (value, parent) => {
      const node = figma.createText(); node.characters = value;
      if (parent) parent.appendChild(node);
      return node;
    };
    const row = figma.createComponent(); row.name = 'BookRow/default'; row.resize(300, 80);
    text('BookRow/default', row);
    const selected = figma.createComponent(); selected.name = 'BookRow/selected'; selected.resize(300, 80);
    text('BookRow/default');
    text('BookRow / selected');
    text('BookRow');
    text('Rows');
    text('color.surface  #112233');
    figma.currentPage = flow;
    text('BookRow/selected');
  `,
    true,
  );
  const labels = validateCanvas(root, {}).warnings.filter(
    (warning) => warning.code === 'master-label',
  );
  expect(labels.map((warning) => warning.message)).toEqual([
    expect.stringContaining('"BookRow/default"'),
    expect.stringContaining('"BookRow / selected"'),
  ]);
}, 60000);

it('warns about token sample labels that show a stale value', async () => {
  const root = fixture();
  await applyDesignSystem(root);
  evalDocument(
    root,
    `
    const flow = figma.currentPage;
    const system = figma.createPage(); system.name = 'Design System';
    figma.currentPage = system;
    const text = (value, parent) => {
      const node = figma.createText(); node.characters = value;
      if (parent) parent.appendChild(node);
      return node;
    };
    text('color.surface  #112233');
    text('color.surface | #222222');
    text('space.md 16px');
    text('space.md');
    text('Spacing 24');
    text('color.surface #112233\\nspace.md 12');
    const row = figma.createComponent(); row.name = 'BookRow/default'; row.resize(300, 80);
    text('color.surface #999999', row);
    figma.currentPage = flow;
    text('color.surface #333333');
  `,
    true,
  );
  expect(
    validateCanvas(root, {})
      .warnings.filter((warning) => warning.code === 'token-label')
      .map((warning) => warning.message),
  ).toEqual([
    expect.stringContaining(
      'Sample label for color.surface shows #222222; manifest is #112233',
    ),
    expect.stringContaining(
      'Sample label for space.md shows 16; manifest is 12',
    ),
  ]);
}, 60000);

// Decodes an 8-bit RGB or RGBA PNG into its pixels.
function pngPixels(file: string): {
  width: number;
  channels: number;
  data: Buffer;
} {
  const png = readFileSync(file);
  let offset = 8;
  const idat: Buffer[] = [];
  let width = 0,
    height = 0,
    channels = 0;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      expect(body[8]).toBe(8);
      channels = ({ 2: 3, 6: 4 } as Record<number, number>)[body[9] ?? 0] ?? 0;
      expect(channels).toBeGreaterThan(0);
    }
    if (type === 'IDAT') idat.push(body);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x] ?? 0;
      const left = x >= channels ? (data[y * stride + x - channels] ?? 0) : 0;
      const up = y > 0 ? (data[(y - 1) * stride + x] ?? 0) : 0;
      const corner =
        x >= channels && y > 0
          ? (data[(y - 1) * stride + x - channels] ?? 0)
          : 0;
      const paeth = () => {
        const p = left + up - corner;
        const [a, b, c] = [
          Math.abs(p - left),
          Math.abs(p - up),
          Math.abs(p - corner),
        ];
        return a <= b && a <= c ? left : b <= c ? up : corner;
      };
      const predictor =
        [0, left, up, (left + up) >> 1, paeth()][filter ?? 0] ?? 0;
      data[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  return { width, channels, data };
}

it('exports pages with an opaque background without changing the project file', async () => {
  const root = fixture();
  await applyDesignSystem(root);
  evalDocument(
    root,
    `
    const system = figma.createPage(); system.name = 'Design System';
    figma.currentPage = system;
    const row = figma.createComponent(); row.name = 'BookRow/default'; row.resize(120, 40);
    row.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1 }];
    const swatch = figma.createRectangle(); swatch.resize(40, 40); swatch.x = 200; swatch.y = 60;
    swatch.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1 }];
  `,
    true,
  );
  const before = readFileSync(figPath(root));
  const [output] = renderPages(root, ['Design System']);
  expect(output).toBe(pageRenderPath(root, 'Design System'));
  expect(output).toMatch(/renders\/pages\/design-system\.png$/);
  expect(readFileSync(figPath(root)).equals(before)).toBe(true);
  const image = pngPixels(output ?? '');
  if (image.channels === 4)
    for (let index = 3; index < image.data.length; index += 4)
      expect(image.data[index]).toBe(255);
  // The top-right pixel lies outside both nodes and shows the page background system apply chose.
  const corner = (pixels: ReturnType<typeof pngPixels>) => {
    const offset = (pixels.width - 1) * pixels.channels;
    return [...pixels.data.subarray(offset, offset + 3)];
  };
  expect(
    '#' +
      corner(image)
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase(),
  ).toBe(pageBackground(readDesignSystem(root)));
  renderPages(root, ['Design System'], '#00ff00');
  expect(corner(pngPixels(output ?? ''))).toEqual([0, 255, 0]);
  writeFileSync(
    systemPath(root),
    readFileSync(systemPath(root), 'utf8').replace(
      'tokens:',
      "tokens:\n  - name: color.canvas\n    type: COLOR\n    value: '#0000ff'",
    ),
  );
  renderPages(root, ['Design System']);
  expect(corner(pngPixels(output ?? ''))).toEqual([0, 0, 255]);
  expect(() => renderPages(root, ['Missing'])).toThrow('Unknown page: Missing');
}, 60000);

it('chooses a neutral page background slightly apart from every token color', () => {
  const root = fixture();
  const system = (colors: string[], extra = '') => {
    writeFileSync(
      systemPath(root),
      `version: 1\ntokens:\n${colors
        .map(
          (value, index) =>
            `  - name: color.c${index}\n    type: COLOR\n    value: '${value}'\n`,
        )
        .join(
          '',
        )}  - name: color.scrim\n    type: COLOR\n    value: '#FFFFFF80'\ncomponents:\n  - name: Row\n    states: [default]\n${extra}`,
    );
    return () => readDesignSystem(root);
  };
  // Light palettes get a light gray and dark palettes a dark one; translucent colors are ignored.
  expect(
    pageBackground(system(['#FFFFFF', '#F5F5F7', '#111111', '#1769FF'])()),
  ).toBe('#DADADA');
  expect(
    pageBackground(system(['#0B0B0F', '#16161C', '#F2F2F2', '#FF5A36'])()),
  ).toBe('#2A2A2A');
  expect(
    pageBackground(system(['#FFFFFF'], "pageBackground: '#b0b0b0'\n")()),
  ).toBe('#B0B0B0');
  expect(system(['#FFFFFF'], "pageBackground: '#FAFAFA'\n")).toThrow(
    'too close to a token color',
  );
  expect(system(['#FFFFFF'], "pageBackground: '#C0D0F0'\n")).toThrow(
    'not a neutral gray',
  );
});

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
  // Pages created after the first system apply keep OpenPencil's default background.
  expect(
    validateCanvas(root, { collection: ids.collection })
      .warnings.map((warning) => warning.code)
      .filter((code) => code === 'page-background'),
  ).toEqual(['page-background', 'page-background', 'page-background']);
  expect(await applyDesignSystem(root)).toMatchObject({
    pageBackground: '#323232',
    pages: ['Flow: Detail', 'Shared', 'Design System'],
  });
  // The fixture shows only the default state; the selected master stays unused.
  expect(validateCanvas(root, { collection: ids.collection })).toMatchObject({
    valid: true,
    warnings: [expect.objectContaining({ code: 'component-unused' })],
  });
  const native = inspectNativeSystem(root);
  expect(native.pages.map((page) => page.background)).toEqual([
    '#323232',
    '#323232',
    '#323232',
    '#323232',
  ]);
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
}, 60000);
