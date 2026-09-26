# Typography

Read this when choosing typefaces, defining the type scale, setting text for reading or for dense data, or checking that type renders. No typeface is a default for a kind of product. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Choosing typefaces

- **Decision.** Choose a family from the product context in [intentional design](intentional-design.md), not from what is popular. Weigh legibility at the smallest sizes the product uses, the platform's conventions, the personality the direction asks for, the density of the screens, the languages and scripts the content needs (accented characters, and non-Latin scripts where relevant), and numeric features such as tabular figures.
- **Default.** Prefer one family with enough weights. Pair a display face with a body face when the product benefits from more expression, such as editorial or brand-led screens, not to look creative; the pairing should differ clearly in role, not only slightly in shape.
- **Heuristic.** Check that the family has the weights and styles the scale needs; a missing weight is synthesized badly or not rendered at all.

## Hierarchy

- **Default.** Build hierarchy by combining size, weight, color, spacing, and position. Size alone produces many nearly identical steps that readers cannot tell apart.
- **Default.** Use few, clearly distinct steps, named by role (page title, section title, body, supporting text, control label). Remove sizes that differ from a neighbor by one or two pixels; merge them into one role.
- **Heuristic.** Keep display sizes out of dense operational tools, where a large title pushes the work below the fold. A compact scale with weight contrast serves such tools better.

## Reading comfort

- **Default.** Keep long-form text, such as articles, help, and descriptions longer than a few lines, to at most about 75 characters per line, and give it a line height around 1.4 to 1.6 times the size. Do not apply a reading-width limit to every UI element: labels, tables, and toolbars follow their own layout.
- **Constraint.** Text must reflow without horizontal scrolling at a width of 320 CSS pixels ([WCAG 2.2, 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)); design mobile screens so that long words and labels wrap.

## Tracking and case

- **Heuristic.** Tighten letter spacing slightly for large display text and loosen it for small uppercase text, which reads cramped at default spacing.
- **Heuristic.** Use uppercase sparingly. Uppercase micro-labels on every section compete with each other and read slower than sentence case.

## Numbers and data

- **Default.** Use tabular figures in tables, prices, and anything compared by column, so digits align; keep units consistent and right-align numeric columns.
- **Heuristic.** Use a monospace face only where it carries meaning, such as code, identifiers, or fixed-width data, not as decoration for a technical look.

## Localization

- **Default.** Leave room for longer translations and wrapping; labels in many languages run 30 % or more longer than in English. Test real content in the user's language, not placeholder text sized to fit.

## Rendering

- **Constraint.** Renders show only faces that OpenPencil can load: Inter (Regular, Medium, SemiBold, Bold, ExtraBold) and the project fonts in `docs/design/assets/fonts/<Family>/<Style>.ttf` or `.otf`. Text in any other face is left out of the PNG, and `render` and `validate canvas` warn `font-substitution`. Resolve every warning before accepting a render; details are in [the headless reference](openpencil-headless.md).
- **Default.** Add the chosen family's files to the project and record their source and license in `design/system.md`. When a family cannot be supplied, record it there as the intended family and design with the rendered one, so reviewers know what the PNG does not show.

## Sources

- GOV.UK Design System, [layout](https://design-system.service.gov.uk/styles/layout/) and [type scale](https://design-system.service.gov.uk/styles/type-scale/): the maximum of about 75 characters per line and a small scale of clearly distinct sizes.
- Apple, [HIG: typography](https://developer.apple.com/design/human-interface-guidelines/typography), and Microsoft, [Fluent 2: typography](https://fluent2.microsoft.design/typography): role-based type ramps, weight for hierarchy, and platform conventions.
- W3C, [WCAG 2.2 Understanding: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): the standard behind the reflow constraint.
- The rendering section describes Open Prototypen's verified behavior with OpenPencil 0.15.1. The line-height range, and the guidance on pairing, uppercase, monospace, display sizes in dense tools, and translation length, are this project's opinion from common practice.
