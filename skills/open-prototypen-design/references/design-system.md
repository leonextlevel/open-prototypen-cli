# Design system contract and page

Read this when writing `design/system.yaml`, building the `Design System` page, deciding which components and states to build, or importing icons. It covers the contract and the OpenPencil mechanics, not visual taste: [intentional design](intentional-design.md) covers the direction. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Foundations

- **Default.** Define semantic color roles and build them from tonal scales, as [the color reference](color.md) explains, and check real foreground and background pairs in rendered screens.
- **Default.** Define a role-based type scale, as [the typography reference](typography.md) explains: family, weight, size, and line height per role, checked with long labels and real content. Verify that the families and weights appear in a render before committing to them: add the font files under `docs/design/assets/fonts/<Family>/<Style>.ttf` and resolve every `font-substitution` warning, as [the headless reference](openpencil-headless.md) explains.
- **Default.** Define a spacing scale, alignment rules, and, where the direction needs them, radius and elevation scales, as [the layout reference](layout.md) explains.

## The contract

- **Constraint.** Record machine-readable values and the reusable component inventory in `docs/design/design/system.yaml`, and explain in `docs/design/design/system.md` why they serve the product. A prose list of colors or components does not establish a native design system.
- **Constraint.** The v1 contract uses OpenPencil variable types. Quote hex values in YAML so `#` does not start a comment. A component's `screens` are the screen keys used in `interactions.yaml`; a screen counts when the component appears there directly or inside an instance of another component.

```yaml
version: 1
tokens:
  - name: color/canvas
    type: COLOR
    value: '#F7F5F0'
  - name: type/body/family
    type: STRING
    value: Inter
  - name: space/section
    type: FLOAT
    value: 24
components:
  - name: BookRow
    states: [default, selected]
    screens: [collection]
  - name: icon/check
    states: [16-muted, 24-accent]
    screens: [collection]
```

- **Constraint.** Declare the color pairs the screens rely on in an optional `contrast` list, each with a `use`: `text` (4.5:1), `large-text` (3:1), `non-text` (3:1), or `exempt` with a `reason`, for disabled controls and decoration. Both tokens must be declared COLOR tokens, and the background must be opaque; a translucent foreground is composited over its background. `system apply`, `inspect system --json`, and `validate canvas` warn `contrast-pair` when a pair falls below its threshold. Declare text levels on each surface, the foreground on the accent, and focus on its backgrounds, not every combination.

```yaml
contrast:
  - foreground: color/text/secondary
    background: color/surface
    use: text
  - foreground: color/border/interactive
    background: color/canvas
    use: non-text
  - foreground: color/text/disabled
    background: color/surface
    use: exempt
    reason: Disabled controls
```

- **Constraint.** An optional `scales` map names the token prefixes that form the spacing and radius scales, such as `scales: { spacing: space/, radius: radius/ }`; each prefix must match at least one FLOAT token. With it, `validate canvas` warns about unbound values off the scale, as [the layout reference](layout.md) explains.
- **Constraint.** A component name may be namespaced with `/`, such as `icon/check`; state names cannot contain `/`, so the last segment of a master's name is its state. Declare each icon as a component whose states are its size and color variants, with masters named `icon/check/16-muted` and `icon/check/24-accent`.
- **Constraint.** After editing the contract, run `open-prototypen system apply`. It creates the `.fig` if necessary, synchronizes variables, and paints every page with a neutral gray close to the palette's page color but visibly apart from each opaque token color, so screen frames stand out. Set `pageBackground: '#RRGGBB'` at the top level to choose it; the value must be a neutral gray not too close to any token color. `system apply` does not compose the page, components, or screens.
- **Constraint.** Bind token variables to meaningful properties in component masters and shared screen structures, rather than binding each token once while matching copies stay hardcoded. A token bound only to its own sample is not applied: `validate canvas` warns `token-sample-only` when every binding of a variable lies on `Design System` outside component masters. Bind it in a master, whose instances inherit the binding, or in a shared structure, such as the `itemSpacing` of an auto-layout list.

## The Design System page

- **Constraint.** Place every native component master and state from the contract on a page named `Design System`, grouped by component family under short headings, without text that repeats a master's name.
- **Default.** Add visible color, typography, and spacing samples, and radius and elevation samples when the system defines them, labeled with the token name and value and bound to their variables. Export the page with `open-prototypen render --system` and inspect it.

## Components and states

- **Default.** Derive components from the screen map and repeated content. For each reusable component, record its purpose, screens, anatomy, content limits, token roles, and relevant states, and distinguish a shared component from a one-off composition.
- **Constraint.** Create the native master before placing linked instances in screen frames. When a missing component appears during assembly, add it to the inventory and build it first. OpenPencil has no headless variants, so represent materially different states as separately named masters.
- **Heuristic.** Include empty, selected, disabled, loading, and error states only where the flows need them. Make each state understandable without relying on color alone, and consider focus and target size for interactive elements.
- **Default.** Prefer a deliberate set of repeatable primitives over a speculative library. Inspect the actual instances in the `.fig`; duplicated groups are not reusable instances.

## Icons and artwork

- **Default.** Use SVG for interface icons so their geometry and stroke stay editable. Keep view boxes, weight, and optical alignment consistent, and inspect the imported vectors and the render. Do not substitute punctuation glyphs for designed icons.
- **Constraint.** Record the source and license of external artwork. For generated SVG, record that it was made for the project and inspect the markup and the render. Do not introduce remote image dependencies into the `.fig`.

## Final review

- **Default.** Render each screen at its intended size and review hierarchy, spacing, alignment, type, icon weight, contrast, clipping, and every represented state. Use the CLI inspection and OpenPencil lint and analysis as evidence, then verify findings visually; tool warnings are not an aesthetic verdict.

## Sources

- [Design Tokens Format Module](https://www.designtokens.org/TR/2025.10/format/): typed tokens, semantic aliases, and composite values. The project YAML is its own contract, not a claim of full compatibility.
- Carbon [color tokens](https://carbondesignsystem.com/elements/color/tokens/), [spacing](https://carbondesignsystem.com/elements/spacing/overview/), and [component checklist](https://carbondesignsystem.com/contributing/component-checklist/): role-based color, consistent spatial relationships, and component anatomy, states, and accessibility. Use the reasoning, not IBM's values or style.
- [WCAG 2.2](https://www.w3.org/TR/wcag/): contrast and target-size criteria.
- OpenPencil [scripting](https://openpencil.dev/programmable/cli/scripting) and [CLI](https://openpencil.dev/reference/cli): variables, binding, components, instances, inspection, and export.
