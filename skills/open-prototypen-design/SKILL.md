---
name: open-prototypen-design
description: Derive design direction and system, then build and inspect editable OpenPencil screens.
metadata:
  open-prototypen-version: 0.1.0
---

# Design

Read product definition, screen map, UX research, visual research, and the artifact instructions. If visual references do not yet explain their relevance to this product, improve that research first. Derive specific principles before drawing. Avoid default card grids, arbitrary gradients, fake metrics, and decoration without a product reason. Read [the visual system reference](references/visual-system.md) when deciding the foundations, inventory, states, icons, and review criteria.

Explain the direction in `docs/design/design/direction.md` and the system rationale in `docs/design/design/system.md`. Record actual token values and the component inventory in `docs/design/design/system.yaml`, using the contract in the reference. Identify components and necessary states from the screen map before composing screens. Validate the Markdown artifacts, then run `open-prototypen system apply`. It creates `docs/design/prototype/prototype.fig` if absent and synchronizes native variables. Bind the variables to relevant node properties; a variable existing unused is not enough.

Create a page named `Design System` in the `.fig`. Place every native component master named `<name>/<state>` there, including all states declared in `system.yaml`, and arrange them by component family with clear labels. Add editable visual samples of the declared color roles, typography scale, and spacing rhythm so a reader can see the decisions in the file. Keep the examples consistent with `system.yaml`; the YAML remains the source of values and inventory. Use linked instances of these masters in each declared screen. Build the required states, including empty, selected, disabled, and error when the product flows call for them. If a missing reusable component emerges during screen construction, add it to `system.yaml`, create its master on `Design System`, then place its instances. For interface icons, create or select SVGs that fit the visual direction and import them with `open-prototypen svg import <file> --name <name>`; use the editable vector nodes in components or screens. Record external asset sources. The CLI synchronizes and inspects the system; you design the composition.

Organize screen frames across pages by product flow. Keep screens shared by multiple flows on one clearly named shared page, without duplicating their frames. Name screen frames and action nodes clearly. Work incrementally: inspect the canvas, make focused changes, render, inspect the PNG, and refine. Use `open-prototypen inspect system --json` and `open-prototypen validate canvas --json` to check the native system. Put frame IDs and action-node IDs from the saved `.fig` in `interactions.yaml`; `open-prototypen inspect canvas --json` discovers nodes on every page. Run `render` and `prototype` after the design is ready, then hand the result to the component-review skill in a separate agent context for correction before accepting it.

The official npm CLI supports `import <html> -o <file.fig>` for editable conversion and `eval <file.fig> --stdin --write` for focused edits. Use the npm CLI installed alongside Open Prototypen; a desktop executable with the same name may open a GUI. When using HTML import, inspect the result and replace duplicated groups with native components and linked instances. OpenPencil's `tree` command defaults to its first page; pass `--page <name>` when using it directly to inspect other pages.

Minimal `interactions.yaml`:

```yaml
version: 1
initialScreen: collection
screens:
  collection:
    frame: '0:10'
    title: 'Coleção de livros'
    content: 'Lista pessoal com três livros. O primeiro está em leitura e abre o detalhe.'
    actions:
      open-detail:
        node: '0:15'
        label: 'Abrir detalhes do livro'
        event: click
        action: navigate
        target: detail
  detail:
    frame: '0:20'
    title: 'Detalhes do livro'
    content: 'Título, autoria, estado de leitura e nota pessoal do livro selecionado.'
    actions:
      back:
        node: '0:25'
        label: 'Voltar para a coleção'
        event: click
        action: back
```

Replace example IDs with real IDs. Give every screen a title and a textual account of its meaningful visible content; give every action a label in the user's language. These fields are required because PNG text is inaccessible to screen readers. Other actions are `open-overlay` and `close-overlay`; `set-state` takes `key`, `value`, and an optional target screen; `external-link` takes an HTTP(S) `url`. An optional `when: {key, value}` makes an action active only for that state.
