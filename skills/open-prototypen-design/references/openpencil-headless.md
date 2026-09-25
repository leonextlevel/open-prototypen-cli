# Headless OpenPencil

Use this reference when editing the `.fig` with `eval <file.fig> --stdin --write` from the npm CLI pinned by Open Prototypen (`@open-pencil/cli` 0.15.1). The script API resembles the Figma plugin API, but a headless document behaves differently from the desktop editor. Verify anything not listed here with a small script on a copy of the document before relying on it.

## Node IDs and references

- IDs are renumbered in document order on every save. Inserting or removing one node, even on another page, changes the IDs of later nodes, so an ID read before a write is not valid after it. Re-run `open-prototypen inspect canvas --json` after each write that adds or removes nodes.
- Give screen frames and action nodes stable references with `open-prototypen ref set <node-id>=<ref>` and use those references in `interactions.yaml`. A script can also call `node.setSharedPluginData('open-prototypen', 'ref', '<ref>')`.
- Do not put references inside component masters or inside instances. Reference the instance and use `part` for one of its layers. `clone()` copies a node's reference; clear the copy with `open-prototypen ref clear <node-id>`.

## Geometry and layout

- `appendChild` keeps a node's absolute position. Set `x` and `y` after appending, relative to the new parent.
- Text is not measured: every text node reports 100×100 bounds regardless of content or `textAutoResize`. Size text explicitly with `resize(width, height)` when its box matters. Do not use a text node as an action node; use its container or a transparent hit rectangle.
- Auto-layout positions children when the document is saved. Values read in the same script are stale, and unmeasured text still takes part as 100×100. Prefer explicit sizes, or absolute placement for text-heavy groups, and check the render.
- Content outside an unclipped frame enlarges its export, and `render` then fails. Set `frame.clipsContent = true` on screen frames and check that nothing important is cut off.
- Resizing an icon frame does not scale its vectors; use `node.rescale(factor)`. Check imported icons in a render: small details drawn as strokes can import with zero width and disappear.

## Variables, components, and assets

- Bind a variable with `figma.bindVariable(nodeId, 'fills/0/color', variableId)` (other fields include `itemSpacing`). `node.setBoundVariable` and `figma.variables` do not exist. Binding does not repaint an existing literal value: write the value too, or update the variable with `system apply`, which propagates to bound properties.
- Create masters with `figma.createComponent()` and instances with `master.createInstance()`. `detachInstance()` does not exist. Changing a master updates its instances when the document is saved.
- Only Inter is bundled for export; other families are replaced by Inter in PNGs. Run `openpencil fonts <file.fig>` to see each face's status before committing to a family.
- `open-prototypen svg import` places the vector group on the first page. Move it to the `Design System` page, make it an `icon/<name>` master when it is reused, and place instances in screens.
- New pages come from `figma.createPage()`; set `figma.currentPage` before creating nodes on a page. Pages are listed in `figma.root.children`, which may include an internal canvas; find pages by name.
