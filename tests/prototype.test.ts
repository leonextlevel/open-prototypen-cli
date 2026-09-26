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
  resolveInteractions,
} from '../packages/prototype/src/index.js';
import { packageRoot } from '../packages/schemas/src/index.js';
import { pixel, pngPixels } from './png.js';

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

it.skipIf(!existsSync('/usr/bin/google-chrome'))(
  'keeps keyboard focus predictable when actions redraw the prototype',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'open-prototypen-focus-'));
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
      const home = figma.createFrame(); home.name = 'home'; home.resize(300, 160);
      for (const [name, x] of [['toggle', 20], ['open', 110], ['next', 200]]) {
        const node = figma.createRectangle(); node.name = name; node.resize(60, 30);
        home.appendChild(node); node.x = x; node.y = 20;
      }
      const sheet = figma.createFrame(); sheet.name = 'sheet'; sheet.resize(200, 80); sheet.x = 400;
      const close = figma.createRectangle(); close.name = 'close'; close.resize(60, 30);
      sheet.appendChild(close); close.x = 20; close.y = 20;
      const detail = figma.createFrame(); detail.name = 'detail'; detail.resize(200, 160); detail.x = 700;
      const back = figma.createRectangle(); back.name = 'back'; back.resize(60, 30);
      detail.appendChild(back); back.x = 20; back.y = 20;
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
      [
        'home',
        'toggle',
        'open',
        'next',
        'sheet',
        'close',
        'detail',
        'back',
      ].map((ref) => ({ id: id(ref), ref })),
    );
    writeFileSync(
      join(root, 'docs/design/prototype/interactions.yaml'),
      `version: 1
initialScreen: home
screens:
  home:
    frame: home
    title: Home
    content: Home screen.
    actions:
      toggle:
        node: toggle
        label: Show details
        action: set-state
        key: details
        value: shown
      toggle-off:
        node: toggle
        label: Hide details
        when: { key: details, value: shown }
        action: set-state
        key: details
        value: hidden
      open:
        node: open
        label: Open sheet
        action: open-overlay
        target: sheet
      next:
        node: next
        label: Next
        action: navigate
        target: detail
  sheet:
    frame: sheet
    title: Sheet
    content: Sheet content.
    actions:
      close:
        node: close
        label: Close sheet
        action: close-overlay
  detail:
    frame: detail
    title: Detail
    content: Detail screen.
    actions:
      back:
        node: back
        label: Back
        action: back
`,
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
      const focused = () =>
        page.evaluate(() => {
          const element = document.activeElement;
          return element?.tagName === 'H1'
            ? `heading:${element.textContent}`
            : (element?.getAttribute('aria-label') ?? element?.tagName);
        });
      const activate = async (name: string) => {
        await page.getByRole('button', { name }).focus();
        await page.keyboard.press('Enter');
      };
      // A set-state without a target keeps focus on the same slot, now showing the next action.
      await activate('Show details');
      expect(await focused()).toBe('Hide details');
      await activate('Open sheet');
      expect(
        await page.evaluate(() => document.activeElement?.getAttribute('role')),
      ).toBe('dialog');
      await page.keyboard.press('Escape');
      expect(await focused()).toBe('Open sheet');
      await page.keyboard.press('Enter');
      await activate('Close sheet');
      expect(await focused()).toBe('Open sheet');
      await activate('Next');
      expect(await focused()).toBe('heading:Detail');
      await page.keyboard.press('Tab');
      expect(await focused()).toBe('Back');
      await page.keyboard.press('Enter');
      expect(await focused()).toBe('heading:Home');
    } finally {
      await browser.close();
    }
  },
  30000,
);

it.skipIf(!existsSync('/usr/bin/google-chrome'))(
  'simulates scenarios from a panel outside the screens',
  async () => {
    const root = mkdtempSync(join(tmpdir(), 'open-prototypen-scenarios-'));
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
      for (const [name, x] of [['submit', 20], ['open', 100]]) {
        const node = figma.createRectangle(); node.name = name; node.resize(60, 30);
        form.appendChild(node); node.x = x; node.y = 20;
      }
      const sheet = figma.createFrame(); sheet.name = 'sheet'; sheet.resize(200, 80); sheet.x = 300;
      const done = figma.createFrame(); done.name = 'done'; done.resize(200, 160); done.x = 600;
      const error = figma.createFrame(); error.name = 'error'; error.resize(200, 160); error.x = 900;
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
      ['form', 'submit', 'open', 'sheet', 'done', 'error'].map((ref) => ({
        id: id(ref),
        ref,
      })),
    );
    const interactions = (scenarios: string) => `version: 1
initialScreen: form
scenarios:
${scenarios}
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
      submit-error:
        node: submit
        label: Submit
        when: { key: outcome, value: error }
        action: navigate
        target: error
      submit-timeout:
        node: submit
        label: Submit
        when: { key: outcome, value: timeout }
        action: navigate
        target: error
      open:
        node: open
        label: Open sheet
        action: open-overlay
        target: sheet
  sheet:
    frame: sheet
    title: Sheet
    content: Sheet content.
  done:
    frame: done
    title: Done
    content: Done screen.
  error:
    frame: error
    title: Error
    content: Error screen.
`;
    const outcome = `  - key: outcome
    label: Server response
    initial: error
    values:
      - { value: ok, label: Success }
      - { value: error, label: Server error }`;
    const write = (scenarios: string) =>
      writeFileSync(
        join(root, 'docs/design/prototype/interactions.yaml'),
        interactions(scenarios),
      );
    write(`${outcome}\n${outcome}`);
    expect(() => compilePrototype(root)).toThrow(
      'Duplicate scenario key: outcome',
    );
    write(outcome.replace('initial: error', 'initial: maybe'));
    expect(() => compilePrototype(root)).toThrow(
      'Initial value maybe of scenario outcome is not one of its values: ok, error',
    );
    write(
      `${outcome}\n  - key: theme\n    label: Theme\n    initial: light\n    values:\n      - { value: light, label: Light }\n      - { value: dark, label: Dark }`,
    );
    renderScreens(root);
    const result = compilePrototype(root);
    expect(
      result.warnings
        .filter((warning) => warning.code.includes('scenario'))
        .map((warning) => warning.code),
    ).toEqual(['unknown-scenario-value', 'unused-scenario']);
    const manifest = JSON.parse(
      readFileSync(join(result.output, 'manifest.json'), 'utf8'),
    );
    expect(
      manifest.scenarios.map((entry: { key: string }) => entry.key),
    ).toEqual(['outcome', 'theme']);
    const browser = await chromium.launch({
      executablePath: '/usr/bin/google-chrome',
      headless: true,
      args: ['--no-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.goto(pathToFileURL(join(result.output, 'index.html')).href);
      const screen = () => page.locator('body').getAttribute('data-screen');
      const response = page.getByLabel('Server response');
      // The initial value gates the default action from the first visit.
      expect(await response.inputValue()).toBe('error');
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect.poll(screen).toBe('error');
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect.poll(screen).toBe('form');
      await response.focus();
      await response.selectOption('ok');
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
        'SELECT',
      );
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect.poll(screen).toBe('done');
      // Reset restores initial values and clears history.
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect.poll(screen).toBe('form');
      expect(await response.inputValue()).toBe('error');
      // Overlays leave the panel usable.
      await page.getByRole('button', { name: 'Open sheet' }).click();
      await expect
        .poll(() => page.locator('body').getAttribute('data-overlay'))
        .toBe('sheet');
      expect(
        await page.evaluate(() =>
          document.querySelector('.scenarios')?.closest('[inert]'),
        ),
      ).toBeNull();
      await response.selectOption('ok');
      expect(await page.getByRole('dialog', { name: 'Sheet' }).count()).toBe(1);
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect
        .poll(() => page.locator('body').getAttribute('data-overlay'))
        .toBe('');
    } finally {
      await browser.close();
    }
  },
  60000,
);

it('renders screen variants from a base frame with overrides', async () => {
  const root = mkdtempSync(join(tmpdir(), 'open-prototypen-variants-'));
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
    const solid = (r, g, b) => [{ type: 'SOLID', color: { r, g, b, a: 1 }, opacity: 1, visible: true }];
    const banner = figma.createComponent(); banner.name = 'Banner/default'; banner.resize(160, 20);
    const label = figma.createText(); label.name = 'label'; label.characters = 'Pending';
    label.resize(160, 20); banner.appendChild(label);
    banner.x = 600;
    const cart = figma.createFrame(); cart.name = 'cart'; cart.resize(200, 160);
    cart.fills = solid(1, 1, 1);
    const status = figma.createText(); status.name = 'status'; status.characters = 'Ready';
    status.resize(160, 20); cart.appendChild(status); status.x = 20; status.y = 20;
    const pay = figma.createRectangle(); pay.name = 'pay'; pay.resize(60, 30); pay.fills = solid(1, 0, 0);
    cart.appendChild(pay); pay.x = 20; pay.y = 60;
    const retry = figma.createRectangle(); retry.name = 'retry'; retry.resize(60, 30); retry.fills = solid(0, 1, 0);
    cart.appendChild(retry); retry.x = 100; retry.y = 60; retry.visible = false;
    cart.clipsContent = true;
    const done = figma.createFrame(); done.name = 'done'; done.resize(200, 160); done.x = 300;
  `,
    true,
  );
  // Instances go in a later script than their master.
  evalDocument(
    root,
    `
    const banner = figma.root.findAll((node) => node.name === 'Banner/default')[0];
    const cart = figma.root.findAll((node) => node.name === 'cart')[0];
    const notice = banner.createInstance(); cart.appendChild(notice); notice.x = 20; notice.y = 120;
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
  setRefs(root, [
    { id: id('cart'), ref: 'cart' },
    { id: id('status'), ref: 'status-message' },
    { id: id('pay'), ref: 'pay-button' },
    { id: id('retry'), ref: 'retry-button' },
    { id: id('done'), ref: 'done' },
    {
      id:
        tree
          .find((node) => node.name === 'cart')
          ?.children?.find((node) => node.type === 'INSTANCE')?.id ?? '',
      ref: 'notice',
    },
  ]);
  const interactions = (variantActions: string, extra = '') =>
    writeFileSync(
      join(root, 'docs/design/prototype/interactions.yaml'),
      `version: 1
initialScreen: cart
screens:
  cart:
    frame: cart
    title: Cart
    content: Cart ready to pay.
    actions:
      pay:
        node: pay-button
        label: Pay
        action: navigate
        target: cart-error
  cart-error:
    base: cart
    overrides:
      text:
        status-message: Payment was declined
        'notice:label': Declined
      hidden: [pay-button]
      shown: [retry-button]${extra}
    title: Payment declined
    content: The payment was declined; retry it.
    actions:
${variantActions}
  done:
    frame: done
    title: Done
    content: Order placed.
`,
    );
  interactions(
    '      retry:\n        node: retry-button\n        label: Retry\n        action: navigate\n        target: done',
  );
  const before = readFileSync(
    join(root, 'docs/design/prototype/prototype.fig'),
  );
  renderScreens(root);
  expect(
    readFileSync(join(root, 'docs/design/prototype/prototype.fig')).equals(
      before,
    ),
  ).toBe(true);
  const render = (name: string) =>
    pngPixels(join(root, `docs/design/prototype/renders/${name}.png`));
  const [base, variant] = [render('cart'), render('cart-error')];
  expect(pixel(base, 50, 75)).toEqual([255, 0, 0]);
  expect(pixel(base, 130, 75)).toEqual([255, 255, 255]);
  expect(pixel(variant, 50, 75)).toEqual([255, 255, 255]);
  expect(pixel(variant, 130, 75)).toEqual([0, 255, 0]);
  // The text overrides change pixels in the status line and in the instance's label.
  const differs = (y: number) =>
    Array.from({ length: 160 }, (_, x) =>
      pixel(base, 20 + x, y + 10).join(),
    ).join() !==
    Array.from({ length: 160 }, (_, x) =>
      pixel(variant, 20 + x, y + 10).join(),
    ).join();
  expect(differs(20)).toBe(true);
  expect(differs(120)).toBe(true);
  const result = compilePrototype(root);
  const manifest = JSON.parse(
    readFileSync(join(result.output, 'manifest.json'), 'utf8'),
  );
  expect(manifest.screens['cart-error']).toMatchObject({
    width: 200,
    height: 160,
    actions: { retry: { bounds: { x: 100, y: 60, width: 60, height: 30 } } },
  });
  interactions(
    '      pay:\n        node: pay-button\n        label: Pay\n        action: navigate\n        target: done',
  );
  expect(() => compilePrototype(root)).toThrow(
    'Action cart-error.pay: RECTANGLE pay',
  );
  expect(() => compilePrototype(root)).toThrow('is hidden in this variant');
  interactions('      {}', '\n    frame: cart');
  expect(() => renderScreens(root)).toThrow(
    'Screen cart-error needs either a frame or a base',
  );
  interactions('      {}');
  writeFileSync(
    join(root, 'docs/design/prototype/interactions.yaml'),
    readFileSync(
      join(root, 'docs/design/prototype/interactions.yaml'),
      'utf8',
    ).replace('status-message: Payment', 'pay-button: Payment'),
  );
  expect(() => renderScreens(root)).toThrow('is not a text node');
}, 60000);

it('warns about small hotspots unless the WCAG spacing exception applies', async () => {
  const root = mkdtempSync(join(tmpdir(), 'open-prototypen-targets-'));
  projects.push(root);
  initProject(root, 'codex');
  mkdirSync(join(root, 'docs/design/design'), { recursive: true });
  writeFileSync(
    join(root, 'docs/design/design/system.yaml'),
    "version: 1\ntokens:\n  - name: color.surface\n    type: COLOR\n    value: '#112233'\ncomponents:\n  - name: Probe\n    states: [default]\n",
  );
  await applyDesignSystem(root);
  // name, x, y, size
  const nodes: [string, number, number, number][] = [
    ['close', 10, 10, 16],
    ['menu', 30, 10, 16],
    ['lonely', 200, 20, 12],
    ['big', 100, 100, 40],
    ['edge', 142, 110, 16],
    ['first', 10, 150, 16],
    ['second', 30, 150, 16],
  ];
  evalDocument(
    root,
    `
    const screen = figma.createFrame(); screen.name = 'screen'; screen.resize(300, 200);
    for (const [name, x, y, size] of ${JSON.stringify(nodes)}) {
      const node = figma.createRectangle(); node.name = name; node.resize(size, size);
      screen.appendChild(node); node.x = x; node.y = y;
    }
  `,
    true,
  );
  const tree = inspectCanvas(root).tree;
  const screen = tree.find((node) => node.name === 'screen');
  setRefs(root, [
    { id: screen?.id ?? '', ref: 'screen' },
    ...(screen?.children ?? []).map((node) => ({
      id: node.id,
      ref: node.name,
    })),
  ]);
  const action = (name: string, when = '') =>
    `      ${name}:\n        node: ${name}\n        label: ${name}\n        action: set-state\n        key: mode\n        value: '${name}'${when}\n`;
  writeFileSync(
    join(root, 'docs/design/prototype/interactions.yaml'),
    `version: 1\ninitialScreen: screen\nscreens:\n  screen:\n    frame: screen\n    title: Screen\n    content: Screen.\n    actions:\n${[
      'close',
      'menu',
      'lonely',
      'big',
      'edge',
    ]
      .map((name) => action(name))
      .join(
        '',
      )}${action('first', '\n        when: { key: mode, value: close }')}${action('second', '\n        when: { key: mode, value: menu }')}`,
  );
  expect(
    resolveInteractions(root)
      .warnings.filter((warning) => warning.code === 'small-target')
      .map((warning) => warning.message.split(':')[0]),
  ).toEqual([
    'Action screen.close',
    'Action screen.menu',
    'Action screen.edge',
  ]);
}, 60000);
