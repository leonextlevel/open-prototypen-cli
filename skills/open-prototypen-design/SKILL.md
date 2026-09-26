---
name: open-prototypen-design
description: Derive design direction and system, then build and inspect editable OpenPencil screens.
metadata:
  open-prototypen-version: 0.2.0
---

# Design

Read product definition, screen map, UX research, visual research, and the artifact instructions. If visual references do not yet explain their relevance to this product, improve that research first. Derive specific principles before drawing, and justify every generic pattern by the product, as [intentional design](references/intentional-design.md) explains.

Read a reference only when the decision in front of you needs it:

- [Intentional design](references/intentional-design.md): before writing the direction, and whenever a choice feels like a default.
- [Accessibility](references/accessibility.md): while defining the system and composing screens, for contrast, focus, target size, reflow, and the prototype's text alternative; apply it then rather than waiting for the audit.
- [Color](references/color.md): when choosing palette roles and scales, placing the accent, adding a dark theme, or checking contrast.
- [Typography](references/typography.md): when choosing typefaces, defining the type scale, setting text for reading or data, or checking that type renders.
- [Layout](references/layout.md): when setting a screen's structure, choosing spacing and density, grouping content, or defining radius, borders, and elevation.
- [Content](references/content.md): when writing interface text, naming concepts across screens, laying out for other languages, or creating mock data.
- [Forms, feedback, and empty states](references/forms-and-feedback.md): when designing forms, validation and errors, loading or offline status, or screens with nothing to show.
- [Interaction patterns](references/interaction-patterns.md): when choosing navigation, action hierarchy, overlays, safeguards for destructive actions, or how to show a collection.
- [Design review](references/review.md): when critiquing your renders before handing them to component review.
- [Design system contract and page](references/design-system.md): when writing `system.yaml`, building the `Design System` page, choosing components and states, or importing icons.
- [Headless OpenPencil](references/openpencil-headless.md): before scripting edits to the `.fig`.

Explain the direction in `docs/design/design/direction.md`, starting from the product context and its consequences. Its template also offers optional sections, such as density, shape, content voice, and design signature; fill one only when it carries a real decision for this product, and delete the others. Explain the system rationale in `docs/design/design/system.md`. Record actual token values, the component inventory, and the color pairs the screens rely on in `docs/design/design/system.yaml`, using the contract in the reference, and resolve `contrast-pair` warnings before building screens. Identify components and necessary states from the screen map before composing screens, and apply [the accessibility reference](references/accessibility.md) to the foundations and components as you define them. Validate the Markdown artifacts, then run `open-prototypen system apply`. It creates `docs/design/prototype/prototype.fig` if absent, synchronizes native variables, and gives every page a neutral background slightly apart from all token colors so frame edges stay visible. Pages created later keep OpenPencil's default background until the next `system apply`; run it again after adding pages, when `validate canvas` warns `page-background`. Bind the variables to relevant node properties; a variable existing unused is not enough. After removing or renaming a token, rebind its nodes to the declared tokens and run `open-prototypen system apply --prune` to delete the old variable; `validate canvas` warns `token-undeclared` until you do.

Create a page named `Design System` in the `.fig`. Place every native component master named `<name>/<state>` there, including all states declared in `system.yaml`, and arrange them by component family, with a short heading for each group. Do not add text that repeats a master's name or state: the editor already labels every master with its name, and `validate canvas` warns `master-label` about such text. Keep text for group headings and for the labels of token samples, which are not components. Add editable visual samples of the declared color roles, typography scale, and spacing rhythm, and of the radius and elevation scales when the system defines them, so a reader can see the decisions in the file. Bind the samples to their variables and label each one with its token name followed by its value, such as `color.text  #111111`; when a value changes, update the label with it. `validate canvas` warns `token-label` when a label on this page shows a value that differs from `system.yaml`. The YAML remains the source of values and inventory. Export this page with `open-prototypen render --system`, which writes `docs/design/prototype/renders/pages/design-system.png` on an opaque background without changing the `.fig`, and inspect it; do not add background rectangles to the page for exports. Use linked instances of these masters in each declared screen. Build the required states, including empty, selected, disabled, and error when the product flows call for them. If a missing reusable component emerges during screen construction, add it to `system.yaml`, create its master on `Design System`, then place its instances. For interface icons, create or select SVGs that fit the visual direction and import them with `open-prototypen svg import <file> --name icon/<name> --page "Design System" --variants <size>:<color token>,...` to create one bound master per size and color, or with `--component` for a single master; use the editable vector nodes in components or screens. Record external asset sources. The CLI synchronizes and inspects the system; you design the composition.

Organize screen frames across pages by product flow. Keep screens shared by multiple flows on one clearly named shared page, without duplicating their frames. Name screen frames and action nodes clearly. Enable `clipsContent` on screen frames. Make every action node a sized shape, container, or instance rather than a text node, adding a transparent hit area when needed. A `small-target` warning means a hotspot is under 24×24 px and too close to another for WCAG's spacing exception; enlarge its transparent hit area without enlarging the icon, or move the targets apart. Work incrementally: inspect the canvas, make focused changes, render, inspect the PNG, and refine. Use `open-prototypen inspect system --json` and `open-prototypen validate canvas --json` to check the native system and act on its warnings.

The official npm CLI supports `import <html> -o <file.fig>` for editable conversion and `eval <file.fig> --stdin --write` for focused edits. Use the npm CLI installed alongside Open Prototypen; a desktop executable with the same name may open a GUI. Prefer `open-prototypen eval <script.js> --write`, which injects helpers that resolve masters, tokens, and references by name. Read [the headless OpenPencil reference](references/openpencil-headless.md) before scripting edits: node IDs change on every save that adds or removes nodes, text is not measured, and several editor APIs are missing. When using HTML import, inspect the result and replace duplicated groups with native components and linked instances. OpenPencil's `tree` command defaults to its first page; pass `--page <name>` when using it directly to inspect other pages.

Give each screen frame and action node a stable reference with `open-prototypen ref set <node-id>=<ref> ...`, using current IDs from `open-prototypen inspect canvas --json`, and write those references, not node IDs, in `interactions.yaml`. Reference instances rather than layers inside them; select a layer inside an instance with `part`. Represent every flow state that matters, including errors and deadlines, as a screen reachable through actions. When a state differs from another screen only in text or in which nodes are visible, declare it as a variant instead of cloning the frame, so the states cannot drift apart: give the screen `base: <screen key>` instead of `frame`, and `overrides` with `text` (reference, or `<ref>:<part>` inside an instance, mapped to new characters), `hidden`, and `shown` (lists of references). `render` applies them to a temporary copy of the `.fig`; hotspots use the base frame, and actions on hidden nodes are rejected; use `set-state` and `when` to simulate outcomes the prototype cannot compute, and treat `unreachable-screen` warnings as missing paths.

Run `render` after the design is ready and critique your own PNGs with [the design review questions](references/review.md), including the intentionality pass, against the direction; refine and render again until they hold. Then run `prototype` and hand the result to the component-review skill in a separate agent context for correction before accepting it. If `validate canvas` or `prototype` already fails because a screen lacks a linked instance, run the review first.

Minimal `interactions.yaml`:

```yaml
version: 1
initialScreen: collection
screens:
  collection:
    frame: collection
    title: 'Coleção de livros'
    content: 'Lista pessoal com três livros. O primeiro está em leitura e abre o detalhe.'
    actions:
      open-detail:
        node: book-row-1
        label: 'Abrir detalhes do livro'
        event: click
        action: navigate
        target: detail
  detail:
    frame: detail
    title: 'Detalhes do livro'
    content: 'Título, autoria, estado de leitura e nota pessoal do livro selecionado.'
    actions:
      back:
        node: back-button
        label: 'Voltar para a coleção'
        event: click
        action: back
```

Replace the example references with the references assigned in the `.fig`; an action can add `part: <layer name>` when `node` is an instance. Give every screen a title and a textual account of its meaningful visible content; give every action a label in the user's language. These fields are required because PNG text is inaccessible to screen readers. Other actions are `open-overlay`, which shows the target screen as a modal centered over the dimmed current screen, or anchored to its bottom edge with `placement: bottom` for bottom sheets, and `close-overlay`; `set-state` takes `key`, `value`, and an optional target screen; `external-link` takes an HTTP(S) `url`. An optional `when: {key, value}` makes an action active only for that state.

Simulate outcomes the prototype cannot compute, such as a server error or a resource conflict, with runtime state. State lasts for the visit and starts empty, except for declared scenarios, so a `when` action is inactive until a scenario or a `set-state` action sets its key. Use scenarios for outcomes outside the product's control, such as a server response, and keep `set-state` for choices the product user makes. When active actions share a node, only the one declared last gets a hotspot, for pointer, keyboard, and screen reader users alike. Declare the default action first and the state-specific override after it on the same node; a `covered-action` warning means an earlier action can never be clicked.

The exit from an error state leads to a screen that reflects the error and lets the user complete the task by another path. Choose the pattern by whether retrying can succeed:

- **Transient failure**, where retrying may succeed, such as a checkout flow where the server rejects the order. The first attempt records the failure and shows the error screen; its retry action completes the order.

  ```yaml
  actions:
    submit:
      node: submit-button
      label: '<Submit label in the user language>'
      action: set-state
      key: order
      value: rejected
      target: order-error
  ```

  `order-error` shows the rejection and gives a retry action that navigates to `confirmation`.

- **Resource conflict**, where retrying the same request cannot succeed, such as a booking form where the slot was just taken. Never let a retry book the lost resource. Declare a scenario, which the prototype shows as a control in a panel beside the screens, and override the default action while it is set; do not draw simulation controls into product frames:

  ```yaml
  scenarios:
    - key: slot
      label: '<Slot availability in the user language>'
      initial: free
      values:
        - { value: free, label: '<Available>' }
        - { value: taken, label: '<Taken by someone else>' }
  ```

  ```yaml
  actions:
    submit:
      node: submit-button
      label: '<Submit label in the user language>'
      action: navigate
      target: confirmation
    submit-conflict:
      node: submit-button
      label: '<Submit label in the user language>'
      when: { key: slot, value: taken }
      action: navigate
      target: slot-taken
  ```

  `slot-taken` shows the lost slot as unavailable and lets the user choose another one and finish the booking.

Replace the placeholders with labels in the user's language. A scenario's `initial` value is set when the prototype opens and after the panel's Reset, which also clears history and returns to the initial screen. `unused-scenario` warns about a scenario that no `when` uses, and `unknown-scenario-value` about a `when` waiting for a value its scenario does not declare.
