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
  inspectCanvas,
  relativeBounds,
} from '../packages/openpencil/src/index.js';
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
}, 20000);
