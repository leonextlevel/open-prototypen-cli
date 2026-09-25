import { execFileSync } from 'node:child_process';
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
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { afterEach, expect, it } from 'vitest';
import { initProject } from '../packages/harness/src/index.js';
import {
  evalDocument,
  inspectCanvas,
  relativeBounds,
} from '../packages/openpencil/src/index.js';
import { setRefs } from '../packages/openpencil/src/refs.js';
import { applyDesignSystem } from '../packages/openpencil/src/system.js';
import {
  compilePrototype,
  renderScreens,
} from '../packages/prototype/src/index.js';
import { packageRoot } from '../packages/schemas/src/index.js';

const projects: string[] = [];
afterEach(() => {
  for (const path of projects.splice(0))
    rmSync(path, { recursive: true, force: true });
});

it('renders a real editable fig and navigates measured hotspots in Chrome', async () => {
  const root = mkdtempSync(join(tmpdir(), 'open-prototypen-design-'));
  projects.push(root);
  initProject(root, 'codex');
  // Legacy projects have no native-system gate and keep the v1 compile behavior.
  writeFileSync(
    join(root, 'docs/design/config.yaml'),
    'version: 1\nschema: default\nlanguage:\n  mode: auto\n  fallback: en\ndesignEngine: openpencil\n',
  );
  const html = join(root, 'screen.html');
  writeFileSync(
    html,
    '<html><body><div style="width:320px;height:200px"><h1>Library</h1><button>Open</button></div></body></html>',
  );
  const fig = join(root, 'docs/design/prototype/prototype.fig');
  mkdirSync(join(fig, '..'), { recursive: true });
  execFileSync(process.execPath, [
    join(packageRoot(), 'node_modules/@open-pencil/cli/bin/openpencil.js'),
    'import',
    html,
    '-o',
    fig,
  ]);
  const canvas = inspectCanvas(root);
  const frame = canvas.tree.find((node) => node.type === 'FRAME');
  const button = frame?.children?.find((node) => node.name === 'Open');
  expect(frame && button).toBeTruthy();
  if (!frame || !button)
    throw new Error('OpenPencil import did not create expected nodes');
  execFileSync(process.execPath, [
    join(packageRoot(), 'node_modules/@open-pencil/cli/bin/openpencil.js'),
    'eval',
    fig,
    '-c',
    `figma.getNodeById(${JSON.stringify(button.id)}).y = 100`,
    '--write',
  ]);
  expect(relativeBounds(inspectCanvas(root).tree, frame.id, button.id).y).toBe(
    100,
  );
  expect(
    relativeBounds(inspectCanvas(root).tree, frame.id, button.id).width,
  ).toBeGreaterThan(0);
  writeFileSync(
    join(root, 'docs/design/prototype/interactions.yaml'),
    `version: 1\ninitialScreen: library\nscreens:\n  library:\n    title: Biblioteca\n    content: Um livro de exemplo.\n    frame: '${frame.id}'\n    actions:\n      open:\n        label: Abrir detalhes\n        node: '${button.id}'\n        action: navigate\n        target: detail\n  detail:\n    title: Detalhes\n    content: Um livro de exemplo, com detalhes.\n    frame: '${frame.id}'\n    actions:\n      back:\n        label: Voltar\n        node: '${button.id}'\n        action: back\n`,
  );
  expect(renderScreens(root)).toHaveLength(2);
  const result = compilePrototype(root);
  expect(existsSync(join(result.output, 'screens/library.png'))).toBe(true);
  const manifest = JSON.parse(
    readFileSync(join(result.output, 'manifest.json'), 'utf8'),
  );
  expect(manifest.screens.library.actions.open.bounds.width).toBeGreaterThan(0);
  if (existsSync('/usr/bin/google-chrome')) {
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 390, height: 100 },
      });
      await page.goto(pathToFileURL(join(result.output, 'index.html')).href);
      expect(await page.locator('html').getAttribute('lang')).toBe('en');
      expect(
        await page.getByRole('heading', { name: 'Biblioteca' }).count(),
      ).toBe(1);
      expect(
        await page.getByText('Um livro de exemplo.', { exact: true }).count(),
      ).toBe(1);
      const stage = await page.locator('.stage').first().boundingBox();
      const image = await page.locator('.stage img').first().boundingBox();
      const hotspot = await page
        .getByRole('button', { name: 'Abrir detalhes' })
        .boundingBox();
      expect(stage?.height).toBeLessThanOrEqual(100);
      expect(image?.height).toBeCloseTo(stage?.height ?? 0, 0);
      expect((hotspot?.y ?? 0) - (stage?.y ?? 0)).toBeCloseTo(50, 0);
      await expect
        .poll(() => page.locator('body').getAttribute('data-screen'))
        .toBe('library');
      await page.getByRole('button', { name: 'Abrir detalhes' }).click();
      await expect
        .poll(() => page.locator('body').getAttribute('data-screen'))
        .toBe('detail');
      await page.getByRole('button', { name: 'Voltar' }).click();
      await expect
        .poll(() => page.locator('body').getAttribute('data-screen'))
        .toBe('library');
    } finally {
      await browser.close();
    }
  }
}, 60000);

it.skipIf(!existsSync('/usr/bin/google-chrome'))(
  'makes overlays modal for keyboard and assistive technology',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'open-prototypen-overlay-'));
    projects.push(root);
    initProject(root, 'codex');
    writeFileSync(
      join(root, 'docs/design/config.yaml'),
      'version: 1\nschema: default\nlanguage:\n  mode: auto\n  fallback: en\ndesignEngine: openpencil\n',
    );
    mkdirSync(join(root, 'docs/design/design'), { recursive: true });
    writeFileSync(
      join(root, 'docs/design/design/system.yaml'),
      "version: 1\ntokens:\n  - name: color.surface\n    type: COLOR\n    value: '#112233'\ncomponents:\n  - name: Probe\n    states: [default]\n",
    );
    await applyDesignSystem(root);
    evalDocument(
      root,
      `
      const home = figma.createFrame(); home.name = 'home'; home.resize(200, 160);
      const open = figma.createRectangle(); open.name = 'open'; open.resize(60, 30);
      home.appendChild(open); open.x = 20; open.y = 20;
      const peek = figma.createRectangle(); peek.name = 'peek'; peek.resize(60, 30);
      home.appendChild(peek); peek.x = 100; peek.y = 20;
      const sheet = figma.createFrame(); sheet.name = 'sheet'; sheet.resize(200, 80); sheet.x = 300;
      const close = figma.createRectangle(); close.name = 'close'; close.resize(60, 30);
      sheet.appendChild(close); close.x = 20; close.y = 20;
    `,
      true,
    );
    const tree = inspectCanvas(root).tree;
    const id = (name: string) => {
      const visit = (nodes: typeof tree): string | undefined =>
        nodes
          .map((node) =>
            node.name === name ? node.id : visit(node.children ?? []),
          )
          .find(Boolean);
      return visit(tree) ?? '';
    };
    setRefs(
      root,
      ['home', 'open', 'peek', 'sheet', 'close'].map((ref) => ({
        id: id(ref),
        ref,
      })),
    );
    writeFileSync(
      join(root, 'docs/design/prototype/interactions.yaml'),
      `version: 1\ninitialScreen: home\nscreens:\n  home:\n    frame: home\n    title: Home\n    content: Home screen.\n    actions:\n      open:\n        node: open\n        label: Open sheet\n        action: open-overlay\n        target: sheet\n      peek:\n        node: peek\n        label: Peek sheet\n        action: open-overlay\n        target: sheet\n        placement: bottom\n  sheet:\n    frame: sheet\n    title: Sheet\n    content: Sheet content.\n    actions:\n      close:\n        node: close\n        label: Close sheet\n        action: close-overlay\n`,
    );
    renderScreens(root);
    const result = compilePrototype(root);
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(join(result.output, 'index.html')).href);
      await page.getByRole('button', { name: 'Open sheet' }).click();
      const dialog = page.getByRole('dialog', { name: 'Sheet' });
      await expect.poll(() => dialog.count()).toBe(1);
      expect(
        await page.evaluate(() => document.activeElement?.getAttribute('role')),
      ).toBe('dialog');
      // Only the overlay's hotspots stay outside an inert subtree.
      expect(
        await page.evaluate(() =>
          [...document.querySelectorAll('button.hotspot')]
            .filter((button) => !button.closest('[inert]'))
            .map((button) => button.getAttribute('aria-label')),
        ),
      ).toEqual(['Close sheet']);
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() =>
          document.activeElement?.getAttribute('aria-label'),
        ),
      ).toBe('Close sheet');
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() =>
          document.activeElement?.getAttribute('aria-label'),
        ),
      ).not.toBe('Open sheet');
      await page.keyboard.press('Escape');
      await expect
        .poll(() => page.locator('body').getAttribute('data-overlay'))
        .toBe('');
      expect(
        await page.evaluate(() => document.querySelector('[inert]')),
      ).toBeNull();
      await page.getByRole('button', { name: 'Peek sheet' }).click();
      const base = await page.locator('.stage[inert]').boundingBox();
      const sheet = await dialog.boundingBox();
      expect(sheet?.width).toBeCloseTo(base?.width ?? 0, 0);
      expect(sheet?.x).toBeCloseTo(base?.x ?? 0, 0);
      expect((sheet?.y ?? 0) + (sheet?.height ?? 0)).toBeCloseTo(
        (base?.y ?? 0) + (base?.height ?? 0),
        0,
      );
    } finally {
      await browser.close();
    }
  },
  30000,
);

it.skipIf(!existsSync('/usr/bin/google-chrome'))(
  'renders only the effective action on a shared node for every input method',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'open-prototypen-precedence-'));
    projects.push(root);
    initProject(root, 'codex');
    writeFileSync(
      join(root, 'docs/design/config.yaml'),
      'version: 1\nschema: default\nlanguage:\n  mode: auto\n  fallback: en\ndesignEngine: openpencil\n',
    );
    mkdirSync(join(root, 'docs/design/design'), { recursive: true });
    writeFileSync(
      join(root, 'docs/design/design/system.yaml'),
      "version: 1\ntokens:\n  - name: color.surface\n    type: COLOR\n    value: '#112233'\ncomponents:\n  - name: Probe\n    states: [default]\n",
    );
    await applyDesignSystem(root);
    evalDocument(
      root,
      `
      const form = figma.createFrame(); form.name = 'form'; form.resize(200, 160);
      const submit = figma.createRectangle(); submit.name = 'submit'; submit.resize(60, 30);
      form.appendChild(submit); submit.x = 20; submit.y = 20;
      const simulate = figma.createRectangle(); simulate.name = 'simulate'; simulate.resize(60, 30);
      form.appendChild(simulate); simulate.x = 100; simulate.y = 20;
      const done = figma.createFrame(); done.name = 'done'; done.resize(200, 160); done.x = 300;
      const error = figma.createFrame(); error.name = 'error'; error.resize(200, 160); error.x = 600;
    `,
      true,
    );
    const tree = inspectCanvas(root).tree;
    const id = (name: string) => {
      const visit = (nodes: typeof tree): string | undefined =>
        nodes
          .map((node) =>
            node.name === name ? node.id : visit(node.children ?? []),
          )
          .find(Boolean);
      return visit(tree) ?? '';
    };
    setRefs(
      root,
      ['form', 'submit', 'simulate', 'done', 'error'].map((ref) => ({
        id: id(ref),
        ref,
      })),
    );
    writeFileSync(
      join(root, 'docs/design/prototype/interactions.yaml'),
      `version: 1
initialScreen: form
screens:
  form:
    frame: form
    title: Form
    content: Form screen.
    actions:
      submit:
        node: submit
        label: Submit
        action: navigate
        target: done
      simulate:
        node: simulate
        label: Simulate server error
        action: set-state
        key: outcome
        value: error
      submit-error:
        node: submit
        label: Submit
        when: { key: outcome, value: error }
        action: navigate
        target: error
  done:
    frame: done
    title: Done
    content: Done screen.
  error:
    frame: error
    title: Error
    content: Error screen.
`,
    );
    renderScreens(root);
    const result = compilePrototype(root);
    expect(
      result.warnings.filter((warning) => warning.code === 'covered-action'),
    ).toEqual([]);
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage();
      const url = pathToFileURL(join(result.output, 'index.html')).href;
      const submit = page.getByRole('button', { name: 'Submit' });
      await page.goto(url);
      expect(await submit.count()).toBe(1);
      await page.getByRole('button', { name: 'Simulate server error' }).click();
      expect(await submit.count()).toBe(1);
      await submit.focus();
      await page.keyboard.press('Enter');
      await expect
        .poll(() => page.locator('body').getAttribute('data-screen'))
        .toBe('error');
      await page.goto(url);
      await page.getByRole('button', { name: 'Simulate server error' }).click();
      await submit.click();
      await expect
        .poll(() => page.locator('body').getAttribute('data-screen'))
        .toBe('error');
    } finally {
      await browser.close();
    }
  },
  30000,
);
