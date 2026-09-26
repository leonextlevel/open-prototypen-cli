# Headless OpenPencil

Use this reference when editing the `.fig` with `eval <file.fig> --stdin --write` from the npm CLI pinned by Open Prototypen (`@open-pencil/cli` 0.15.1). The script API resembles the Figma plugin API, but a headless document behaves differently from the desktop editor. Verify anything not listed here with a small script on a copy of the document before relying on it.

## Build scripts and helpers

Run scripts with `open-prototypen eval <script.js> --write`, which uses the pinned OpenPencil on the project `.fig` and injects helpers as `op`; without `--write` the changes are discarded, and `--json` prints the script's return value. The helpers resolve nodes by name or reference, so a script does not depend on IDs read before a save:

- `op.token(name)` returns the native variable of a declared token.
- `op.bind(node, field, tokenName)` binds a field such as `'fills/0/color'`, `'strokes/0/color'`, `'itemSpacing'`, or `'paddingLeft'` and writes the token's value.
- `op.master(name)` returns the one component master with that name; `op.page(name)` returns a page, and `op.page(name, { create: true })` adds it when missing.
- `op.byRef(ref)` and `op.setRef(node, ref)` read and assign stable references; `setRef` rejects a reference that another node already has.
- `op.freeSpot(page)` returns `{ x, y }` to the right of the page's content.
- `op.place(master, parent, x, y, overrides)` creates an instance of a master or master name inside a parent, and applies `overrides` such as `{ title: { characters: 'Dom Casmurro' } }` to named layers.

A master and its instances belong in separate scripts, because an instance created in the master's script is saved with stale child positions (see below):

```js
// masters.js
const system = op.page('Design System', { create: true });
figma.currentPage = system;
const row = figma.createComponent();
row.name = 'BookRow/default';
row.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1 }];
op.bind(row, 'fills/0/color', 'color/surface');
const title = figma.createText();
title.name = 'title';
title.characters = 'Title';
title.resize(200, 24);
row.appendChild(title);
row.resize(300, 80);
```

```js
// screens.js, run after masters.js was saved
const row = op.place('BookRow/default', op.byRef('collection'), 20, 100, {
  title: { characters: 'Dom Casmurro' },
});
op.setRef(row, 'first-book');
```

## Node IDs and references

- IDs are renumbered in document order on every save. Inserting or removing one node, even on another page, changes the IDs of later nodes, so an ID read before a write is not valid after it. Re-run `open-prototypen inspect canvas --json` after each write that adds or removes nodes.
- Give screen frames and action nodes stable references with `open-prototypen ref set <node-id>=<ref>` and use those references in `interactions.yaml`. A script can also call `node.setSharedPluginData('open-prototypen', 'ref', '<ref>')`.
- Do not put references inside component masters or inside instances. Reference the instance and use `part` for one of its layers. `clone()` copies a node's reference; clear the copy with `open-prototypen ref clear <node-id>`.

## Geometry and layout

- `appendChild` keeps a node's absolute position. Set `x` and `y` after appending, relative to the new parent.
- Text is not measured: every text node reports 100×100 bounds regardless of content or `textAutoResize`. Size text explicitly with `resize(width, height)` when its box matters. Do not use a text node as an action node; use its container or a transparent hit rectangle.
- Auto-layout positions children when the document is saved. Values read in the same script are stale, and unmeasured text still takes part as 100×100, so give text in auto-layout an explicit size. Build component masters with auto-layout and bound spacing, as shown below; keep absolute placement as the fallback for text-heavy screen groups, and check the render.
- Content outside an unclipped frame enlarges its export, and `render` then fails. Set `frame.clipsContent = true` on screen frames and check that nothing important is cut off.
- Resizing an icon frame does not scale its vectors; `node.rescale(factor)` scales a frame or a master together with its vectors. Check imported icons in a render: small details drawn as strokes can import with zero width and disappear.

## Auto-layout masters with bound spacing

Auto-layout masters keep spacing tokens in the components, and instances inherit the bindings. With OpenPencil 0.15.1:

- Bind `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`, and `itemSpacing` to `space/*` variables, and write the same values, because binding does not repaint a literal. The bindings survive saves.
- Hug sizing (`primaryAxisSizingMode = 'AUTO'` or `layoutSizingHorizontal = 'HUG'`) is not applied headlessly: the frame stays at its size. Resize the master to its padding plus its children and gaps.
- An instance created in the same script as its master is saved with its children at 0,0, until a later save lays them out. Save the master first and create instances in a later script.

```js
// Script 1: the master.
const variable = (name) =>
  figma.getLocalVariables().find((item) => item.name === name);
const button = figma.createComponent();
button.name = 'Button/default';
button.layoutMode = 'HORIZONTAL';
const icon = figma.createRectangle();
icon.name = 'icon';
icon.resize(16, 16);
const label = figma.createText();
label.name = 'label';
label.characters = 'Save';
label.resize(48, 20);
button.appendChild(icon);
button.appendChild(label);
for (const field of ['paddingLeft', 'paddingRight'])
  figma.bindVariable(button.id, field, variable('space/md').id);
for (const field of ['paddingTop', 'paddingBottom', 'itemSpacing'])
  figma.bindVariable(button.id, field, variable('space/sm').id);
button.paddingLeft = button.paddingRight = 16;
button.paddingTop = button.paddingBottom = button.itemSpacing = 8;
button.resize(16 + 16 + 8 + 48 + 16, 8 + 20 + 8);
```

```js
// Script 2, after the first one is saved: the instances.
const button = figma.root
  .findAll((node) => node.name === 'Button/default')
  .find((node) => node.type === 'COMPONENT');
const screen = figma.currentPage.findOne((node) => node.name === 'home');
const instance = button.createInstance();
screen.appendChild(instance);
instance.x = 20;
instance.y = 20;
```

Changing a bound spacing variable with `system apply` updates the padding and gaps of the master and its instances, but not their size, since hug sizing is not applied. Resize the master afterwards; resizing its root does not reach existing instances, so resize them too and check the render.

## Variables, components, and assets

- Bind a variable with `figma.bindVariable(nodeId, 'fills/0/color', variableId)` (other fields include `itemSpacing`). `node.setBoundVariable` and `figma.variables` do not exist. Binding does not repaint an existing literal value: write the value too, or update the variable with `system apply`, which propagates to bound properties.
- Create masters with `figma.createComponent()` and instances with `master.createInstance()`. `detachInstance()` does not exist.
- On save, instances follow the layers inside their master: changes to the master's children, such as their geometry or text, reach every instance. Changes to the master's own root properties, such as its fills, strokes, or size, do not reach existing instances; update those instances too, or keep the values bound to variables and change them with `system apply`, then check the render.
- Instances keep text overrides (`characters`) but discard, on save, changes to the size or strokes of their inner layers, including `rescale` on an instance. For each icon size or color, create a separate master: `open-prototypen svg import check.svg --name icon/check --variants 16:color/icon/muted,24:color/accent --page "Design System"` creates `icon/check/16-muted` and `icon/check/24-accent`, rescaled so their longer side is the size, with vector fills and strokes painted with and bound to the COLOR token. Declare `icon/check` with those states in `system.yaml` and place instances of the masters. For a variant the command cannot express, clone the master, `rescale` or recolor the clone, and name it the same way.
- Resizing an instance does not resize or move its inner layers, so labels stay at the master's width and position. Make a master for each size a component needs instead of stretching instances.
- Only Inter is bundled for export; other families are replaced by Inter in PNGs. Run `openpencil fonts <file.fig>` to see each face's status before committing to a family.
- `open-prototypen svg import <file> --name <name>` places the vector group on the first page, to the right of its content. Pass `--page "Design System"` to import there instead, `--x` and `--y` to choose the position, and `--component` to make the import a master directly; name reused icons as `icon/<name>` masters and place instances in screens. `--json` returns the node's `id`, `name`, `type`, `page`, `x`, and `y`.
- Inspect the `Design System` page with `open-prototypen render --system`, or any page with `render --page <name>`. A plain `openpencil export --page` has a transparent background, because OpenPencil ignores page fills on export; the Open Prototypen command exports from a temporary copy with an opaque background (`--background <hex>`, else a `color/canvas` or `color.canvas` token, else the page background from `system apply`). Place a new master in free space next to its family, then check the export for overlaps.
- New pages come from `figma.createPage()`; set `figma.currentPage` before creating nodes on a page. Pages are listed in `figma.root.children`, which may include an internal canvas; find pages by name.

## Sources

- OpenPencil [scripting](https://openpencil.dev/programmable/cli/scripting) and [CLI](https://openpencil.dev/reference/cli) documentation: the script API, variables, components, and export options.
- Behavior of the pinned `@open-pencil/cli` 0.15.1, verified with small scripts on copies of a document, and Open Prototypen's tests. These are observations of one version, not documented guarantees; re-verify after upgrading OpenPencil.
