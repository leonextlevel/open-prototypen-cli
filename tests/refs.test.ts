import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { initProject } from '../packages/harness/src/index.js';
import {
  evalDocument,
  inspectCanvas,
  pngSize,
  type DesignNode,
} from '../packages/openpencil/src/index.js';
import {
  clearRefs,
  listRefs,
  setRefs,
} from '../packages/openpencil/src/refs.js';
import { applyDesignSystem } from '../packages/openpencil/src/system.js';
import {
  compilePrototype,
  inspectScreen,
  renderScreens,
} from '../packages/prototype/src/index.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});
async function fixture(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'open-prototypen-refs-'));
  roots.push(root);
  initProject(root, 'codex');
  // Without a native-system gate these tests isolate reference and geometry behavior.
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
  return root;
}
function interactions(root: string, yaml: string) {
  writeFileSync(join(root, 'docs/design/prototype/interactions.yaml'), yaml);
}
function named(tree: DesignNode[], name: string): DesignNode {
  const visit = (nodes: DesignNode[]): DesignNode | undefined => {
    for (const node of nodes) {
      if (node.name === name) return node;
      const found = visit(node.children ?? []);
      if (found) return found;
    }
    return undefined;
  };
  const node = visit(tree);
  if (!node) throw new Error(`Missing node ${name}`);
  return node;
}

it('keeps stable references across renumbering and rejects duplicate or misplaced ones', async () => {
  const root = await fixture();
  evalDocument(
    root,
    `
    const system = figma.currentPage; system.name = 'Design System';
    const tabs = figma.createComponent(); tabs.name = 'TabBar/default'; tabs.resize(200, 40);
    const hit = figma.createRectangle(); hit.name = 'hit-detail'; hit.resize(100, 40); hit.x = 100;
    tabs.appendChild(hit);
    const flow = figma.createPage(); flow.name = 'Flow';
    figma.currentPage = flow;
    const collection = figma.createFrame(); collection.name = 'collection'; collection.resize(200, 160);
    const open = figma.createRectangle(); open.name = 'open-detail'; open.resize(40, 30);
    collection.appendChild(open); open.x = 30; open.y = 90;
    const bar = tabs.createInstance(); collection.appendChild(bar); bar.y = 120;
    const detail = figma.createFrame(); detail.name = 'detail'; detail.resize(200, 160); detail.x = 300;
    const back = figma.createRectangle(); back.name = 'back'; back.resize(40, 30);
    detail.appendChild(back); back.x = 0; back.y = 0;
  `,
    true,
  );
  const tree = inspectCanvas(root).tree;
  const collection = named(tree, 'collection');
  const bar = collection.children?.find((node) => node.type === 'INSTANCE');
  if (!bar) throw new Error('Missing instance');
  const master = named(tree, 'TabBar/default');
  expect(() =>
    setRefs(root, [
      { id: named(bar.children ?? [], 'hit-detail').id, ref: 'hit' },
    ]),
  ).toThrow('instance layers are rebuilt');
  expect(() => setRefs(root, [{ id: master.id, ref: 'tabs' }])).toThrow(
    'inside component master',
  );
  setRefs(root, [
    { id: collection.id, ref: 'collection' },
    { id: named(tree, 'detail').id, ref: 'detail-screen' },
    { id: named(tree, 'open-detail').id, ref: 'open-detail' },
    { id: bar.id, ref: 'tab-bar' },
    { id: named(tree, 'back').id, ref: 'back-button' },
  ]);
  expect(() =>
    setRefs(root, [{ id: named(tree, 'detail').id, ref: 'collection' }]),
  ).toThrow('already used');
  interactions(
    root,
    `version: 1
initialScreen: collection
screens:
  collection:
    frame: collection
    title: Collection
    content: Book list.
    actions:
      open:
        node: open-detail
        label: Open
        action: navigate
        target: detail
      tab:
        node: tab-bar
        part: hit-detail
        label: Detail tab
        action: navigate
        target: detail
  detail:
    frame: detail-screen
    title: Detail
    content: Book detail.
    actions:
      back:
        node: back-button
        label: Back
        action: back
`,
  );
  const before = inspectScreen(root, 'collection');
  // Inserting a node before the flow page renumbers every later node ID.
  evalDocument(
    root,
    `figma.root.children.find((page) => page.name === 'Design System').appendChild(figma.createRectangle());`,
    true,
  );
  const after = inspectScreen(root, 'collection');
  expect(after.frame.id).not.toBe(before.frame.id);
  expect(after.actions).toEqual(before.actions);
  expect(after.actions.tab?.bounds).toEqual({
    x: 100,
    y: 120,
    width: 100,
    height: 40,
  });
  expect(after.warnings).toEqual([]);
  expect(renderScreens(root)).toHaveLength(2);
  expect(compilePrototype(root).warnings).toEqual([]);

  evalDocument(
    root,
    `figma.root.children.find((page) => page.name === 'Flow').children[0].children[0].clone();`,
    true,
  );
  const duplicated = listRefs(root);
  expect(duplicated.problems).toHaveLength(1);
  expect(() => renderScreens(root)).toThrow('used by 2 nodes');
  const copy = duplicated.refs.filter((entry) => entry.ref === 'open-detail');
  clearRefs(root, [copy[1]?.id ?? '']);
  expect(listRefs(root).problems).toEqual([]);
}, 60000);

it('rejects non-frame targets, oversized renders, and hotspots outside the frame', async () => {
  const root = await fixture();
  evalDocument(
    root,
    `
    const frame = figma.createFrame(); frame.name = 'screen'; frame.resize(200, 100);
    const inside = figma.createRectangle(); inside.name = 'inside'; inside.resize(40, 30);
    frame.appendChild(inside); inside.x = 10; inside.y = 10;
    const overflow = figma.createRectangle(); overflow.name = 'overflow'; overflow.resize(40, 60);
    frame.appendChild(overflow); overflow.x = 100; overflow.y = 80;
    const label = figma.createText(); label.name = 'label'; label.characters = 'Label';
    frame.appendChild(label);
    const edge = figma.createText(); edge.name = 'edge'; edge.characters = 'Edge';
    frame.appendChild(edge); edge.x = 150;
    const other = figma.createFrame(); other.name = 'other'; other.resize(200, 100); other.x = 300;
  `,
    true,
  );
  const tree = inspectCanvas(root).tree;
  const screen = named(tree, 'screen');
  setRefs(root, [
    { id: screen.id, ref: 'screen' },
    { id: named(tree, 'other').id, ref: 'other' },
    { id: named(tree, 'inside').id, ref: 'inside' },
    { id: named(tree, 'label').id, ref: 'label' },
    { id: named(tree, 'edge').id, ref: 'edge' },
  ]);
  const write = (frame: string, action: string) =>
    interactions(
      root,
      `version: 1\ninitialScreen: screen\nscreens:\n  screen:\n    frame: ${frame}\n    title: Screen\n    content: Content.\n    actions:\n      go:\n        node: ${action}\n        label: Go\n        action: navigate\n        target: screen\n  other:\n    frame: other\n    title: Other\n    content: Unreachable.\n`,
    );
  write('screen', 'inside');
  expect(() => renderScreens(root, 'screen')).toThrow(
    'content outside the frame is being exported',
  );
  evalDocument(
    root,
    `figma.getNodeById(${JSON.stringify(screen.id)}).clipsContent = true;`,
    true,
  );
  const [image] = renderScreens(root, 'screen');
  if (!image) throw new Error('Missing render');
  expect(pngSize(image)).toEqual({ width: 200, height: 100 });
  const good = readFileSync(image);
  const modified = statSync(image).mtimeMs;

  write(`'${named(tree, 'inside').id}'`, 'inside');
  expect(() => renderScreens(root, 'screen')).toThrow(
    'not a top-level frame of a page',
  );
  expect(readFileSync(image).equals(good)).toBe(true);
  expect(statSync(image).mtimeMs).toBe(modified);

  write(`'${screen.id}'`, 'label');
  const inspected = inspectScreen(root, 'screen');
  expect(inspected.warnings.map((warning) => warning.code)).toEqual([
    'node-id',
    'text-action',
  ]);
  write('screen', 'edge');
  expect(() => inspectScreen(root, 'screen')).toThrow(
    'extends outside frame screen',
  );

  write('screen', 'inside');
  renderScreens(root);
  const compiled = compilePrototype(root);
  expect(compiled.warnings).toEqual([
    expect.objectContaining({ code: 'unreachable-screen' }),
  ]);
  evalDocument(
    root,
    `figma.getNodeById(${JSON.stringify(screen.id)}).resize(200, 120);`,
    true,
  );
  expect(() => compilePrototype(root)).toThrow('Run render again');
}, 60000);
