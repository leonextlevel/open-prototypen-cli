# Design review

Read this when critiquing rendered screens: the designer after the first render and before component review, the auditor in its own context, and the refiner when checking a fix. Answer the questions against the PNGs, the `.fig`, and the artifacts, and write findings with a screen or node as evidence. There is no score; a number suggests an objectivity that design judgment does not have. Every question is a **Heuristic** unless marked **Constraint** (checked by the CLI or a standard).

## Intentionality

Ask "why this?" of each major decision: palette, typeface, density, navigation model, radius, surfaces, action hierarchy, charts, dialogs, and wording. An answer in `design/direction.md` or `design/decisions.md` counts. A decision without an answer is probably a default nobody chose; look at it again. Do not demand a reason for every measurement.

## Product fit

- Would the primary user recognize this as made for their task, frequency, and context?
- Does the screen express the direction's consequences, or only its adjectives?

## Genericity

Turn the patterns in [intentional design](intentional-design.md) into questions. A match is a finding only when neither the product nor the direction justifies it.

- Are there cards inside cards, one radius and shadow everywhere, decorative gradients or glass, icons in colored squares, invented metrics, several primary actions, everything centered, or copy no user would say?
- Could this screen belong to an unrelated product without changes?

## Information architecture and navigation

- Can the user tell where they are, where they can go, and how to get back?
- Do labels in navigation match the words users know for these things?

## Task clarity

- Is the primary action of each screen obvious, and does it match the flow's next step?
- Does every error, empty, and loading state say what happened and what to do next?

## Hierarchy and composition

- What is noticed first, second, and last, and is that the intended order?
- Is emphasis spent on what matters, or spread evenly?

## Alignment and spacing

- Do elements share anchors, and does the same relationship always get the same space?
- Are groups formed by proximity and alignment before containers?

## Typography

- Can the hierarchy be read at a glance? Are there sizes that differ by only a pixel or two?
- Does the type fit the product's character and density? Does any text disappear from the render because its font is missing?

## Color

- Is the accent reserved for primary actions, selection, and meaningful highlights?
- Are brand and status colors distinct, and is no meaning carried by color alone?
- **Constraint.** Do text and meaningful non-text UI meet WCAG 2.2 contrast (4.5:1 text, 3:1 large text and UI)?

## Components and states

- Do equivalent elements use the same master, and do all declared states appear where the flows need them?
- Are there detached copies or one-off variants that should be components?

## Forms and feedback

- Are labels visible, required fields marked, errors next to their fields, and actions confirmed?
- Can the user recover from each error without losing their input?

## Content

- Is the copy in the user's language and terms, and specific rather than generic?
- Does mock data look realistic for the product and clearly mock, without invented evidence?

## Accessibility

- **Constraint.** Are interactive targets at least 24 by 24 px or spaced accordingly (WCAG 2.2, 2.5.8)?
- Are focus order and hotspot labels meaningful, and does each screen's `content` describe what is visible?

## Responsive behavior

- Do the frames drawn for each platform follow the recorded rules for what stays, stacks, collapses, or becomes an overlay?

## Cross-screen consistency

- Does each role keep its look across screens: one primary action style, one term per concept, and the same treatment for equivalent states?
- Does the density change only where the task changes?
- Is the design signature present throughout, not only on the first screen?

## Craft

- Are there misalignments, clipped text, uneven icon weights, stray pixels, or inconsistent corner radii?
- Would a careful designer ship this render as is?

## Sources

- Nielsen Norman Group, [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): the navigation, error recovery, consistency, and recognition questions follow these heuristics.
- Carbon, [component checklist](https://carbondesignsystem.com/contributing/component-checklist/): the components and states questions.
- W3C, [WCAG 2.2](https://www.w3.org/TR/wcag/): the contrast and target-size constraints.
- The intentionality pass, the genericity questions, the cross-screen checks, and the refusal of numeric scores are this project's opinion.
