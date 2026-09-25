# Visual system decisions

Use this reference when moving from visual research to an editable OpenPencil design system. It is a decision guide, not a palette, component library, or visual style to copy.

## From references to a direction

- Look at products serving a similar job and at adjacent visual references that suit the intended audience. For each reference, save its source and access date, describe the visible evidence, identify one principle that fits this product, and say what would be inappropriate to copy. Distinguish observation from your interpretation.
- Choose a small number of product-specific principles that answer practical questions: what deserves attention first, how dense the interface should feel, and where the product should sound quiet or expressive. Explain how the principles affect screen layout and components.
- Compare references by their _roles_ (hierarchy, navigation, content treatment, feedback), not by brand colors or surface decoration. Avoid assembling an interface from unrelated screenshots.

## Build foundations before screens

- Define semantic color roles such as canvas, surface, primary text, secondary text, accent, border, success, and error. Use names for purpose rather than raw color names. Keep the palette small enough that each role is clear; check real foreground/background pairs in rendered screens.
- Define a role-based type scale: page title, section title, body, supporting text, and control label as needed. Specify family, weight, size, and line height; check long labels and real content before adding more styles. Verify that the chosen families and weights actually appear in an OpenPencil PNG export before committing to them.
- Define a spacing rhythm and alignment rules. Pick values for relationships (inside a control, between related content, between sections), then use them consistently. Use OpenPencil layout features when they improve editability; avoid relying on absolute placement for repeated content.
- Record the machine-readable values and reusable component inventory in `docs/design/design/system.yaml`; use `docs/design/design/system.md` to explain why these choices serve the product. Apply the variables to the `.fig` and bind repeated semantic values in component masters and shared screen structures, rather than binding each token once while leaving matching copies hardcoded. A prose list of colors or components does not establish a native design system.

The v1 contract uses OpenPencil variable types. Quote hex values in YAML so `#` does not start a comment. A component's `screens` values are the screen keys later used in `interactions.yaml`:

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
```

The native components for this example are `BookRow/default` and `BookRow/selected`. Add only components and states actually used by the product. After editing the contract, run `open-prototypen system apply` to create the `.fig` if necessary and synchronize variables. Create a `Design System` page with all native component masters and their states, plus visible color, typography, and spacing samples labeled by role and value. Bind token variables to meaningful properties in the masters and samples where supported, and use linked instances in the declared screens. `system apply` synchronizes variables; it does not compose the reference page, components, or screens.

## Component inventory and states

- Derive components from the screen map and repeated content. For each reusable component, record its purpose, screens, anatomy, content limits, token roles, and relevant states. Distinguish a shared component from a one-off composition.
- Create a native OpenPencil component before placing its linked instances in screen frames. When a missing component appears during assembly, add it to the inventory and build it first. If the current OpenPencil API does not offer variants, represent materially different states as separately named native components.
- Include empty, active or selected, disabled, loading, and error states only where the flow needs them. Make a visible state understandable without relying on color alone. Consider focus and touch target size for interactive elements.
- Prefer a deliberate set of repeatable primitives over a large speculative library. Inspect actual instances in the `.fig`; duplicated groups are not reusable instances.

## SVG and final review

- Use SVG for interface icons so their geometry and stroke remain editable. Keep view boxes, weight, and optical alignment consistent; inspect the imported vector nodes and the final render. Avoid substituting punctuation glyphs for designed icons. Simple vector decoration may also use SVG when it serves the concept.
- Record the source and license of externally obtained artwork. For generated SVG, record that it was created for the project and inspect the markup and output before use. Do not introduce remote image dependencies into the final `.fig`.
- Render each screen at its intended size. Review hierarchy, spacing, alignment, type, icon weight, contrast, clipping, and all represented states. Use the CLI canvas inspection and OpenPencil lint/analysis as evidence, then verify findings visually; tool warnings alone are not an aesthetic verdict.

## Primary references

- [Design Tokens Format Module](https://www.designtokens.org/TR/2025.10/format/) explains typed tokens, semantic aliases, and composite values. The project YAML is its own contract, not a claim of full DTCG compatibility.
- [Carbon color tokens](https://carbondesignsystem.com/elements/color/tokens/) and [spacing overview](https://carbondesignsystem.com/elements/spacing/overview/) illustrate role-based color and consistent spatial relationships; use the reasoning, not IBM's values or style.
- [Carbon component checklist](https://carbondesignsystem.com/contributing/component-checklist/) covers component anatomy, token use, states, and accessibility.
- [WCAG 2.2](https://www.w3.org/TR/wcag/) defines contrast and target-size criteria for checking interactive screens.
- [OpenPencil scripting](https://openpencil.dev/programmable/cli/scripting) documents variables, binding, components, and instances. [OpenPencil CLI](https://openpencil.dev/reference/cli) documents inspection, analysis, linting, and export.
