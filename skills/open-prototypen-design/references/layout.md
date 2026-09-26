# Layout

Read this when setting up a screen's structure, choosing spacing and density, grouping content, or defining radius, borders, and elevation. It gives guidance, not a grid. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Layout grammar

- **Decision.** Before placing components, set the frame size for each target platform, the content width, columns and gutters, outer margins, and fixed regions such as a sidebar, header, inspector, or reading column. Derive them from the product and platform; there is no universal 12-column grid.
- **Default.** Keep the grammar consistent across screens of one platform, so moving between screens does not shift anchors the user relies on.

## Alignment and grouping

- **Default.** Align elements to shared anchors, and correct optically where geometry misleads, such as round icons beside square ones or text beside an icon.
- **Default.** Express relationships with proximity, whitespace, alignment, type, separators, and a change of background before reaching for a container. A card is one grouping tool, not the default wrapper.
- **Heuristic.** Treat cards inside cards as a smell: each container should group something the user thinks of as one thing.

## Spacing

- **Default.** Choose a spacing scale that expresses relationships: inside a control, between an icon and its label, between related fields, between repeated items, between sections, between unrelated regions, and at page margins. The values are the project's own; what matters is that each relationship always gets the same step.
- **Constraint.** Declare the scale as `space/*` tokens in `system.yaml` and bind them in masters and shared structures, such as the padding and `itemSpacing` of auto-layout frames; `validate canvas` warns about tokens that stay unbound or bound only to samples. Declare `scales: { spacing: space/, radius: radius/ }` in `system.yaml` to have `validate canvas` warn `off-scale-spacing` and `off-scale-radius` about unbound gaps, paddings, and corner radii in screens and masters that no token of the scale contains, grouped by value. Accept a deliberate optical adjustment as one exception in the audit instead of forcing it onto the scale; absolute positions are not checked.
- **Heuristic.** Use auto-layout with bound spacing for component masters and repeated lists, and give text inside it explicit sizes, because headless OpenPencil does not measure text. Absolute placement stays the fallback for text-heavy screen groups; see [the headless reference](openpencil-headless.md).

## Hierarchy and composition

- **Default.** For each important screen, name what the user should notice first, what second, and what stays quiet. Make that order visible through size, weight, contrast, position, and space.
- **Default.** Avoid equal emphasis everywhere and more than one primary action in a single decision context.
- **Heuristic.** Vary the composition of sections when identical repetition hides the structure, for example a lead item followed by a compact list instead of a uniform grid.

## Density

- **Decision.** Choose density from how often and how long people use the screen, their expertise, the amount of information, whether they scan or read, the platform and input, and the cost of mistakes. Neither "more whitespace is better" nor "compact means professional" holds in general.
- **Constraint.** Keep interactive targets at least 24 by 24 CSS pixels, or spaced so that a 24-pixel circle around each does not overlap another ([WCAG 2.2, 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)); dense layouts still need reachable targets.

## Shape, borders, and elevation

- **Decision.** Define a small radius scale that follows the shape character of the direction, such as sharp and technical or soft and friendly, and apply it by role: controls, containers, and overlays may differ. One large radius on everything erases the difference between them.
- **Default.** Use borders for containment, state, interactive boundaries, and separating regions, not on every surface.
- **Default.** Use elevation for layering, such as overlays, menus, and dragged items, not for decoration. A shadow on every card flattens the layers it is meant to show.

## Responsive behavior

- **Default.** Start from content priority: for each region, decide whether it stays, stacks, moves, collapses, becomes an overlay, or is deferred at smaller sizes. Record the behavior as rules, such as "wide: persistent inspector; medium: collapsible; small: contextual overlay", not only as breakpoints, and only for platforms the product targets.
- **Constraint.** Content must reflow without horizontal scrolling at 320 CSS pixels wide ([WCAG 2.2, 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)).
- **Heuristic.** Prototypes render fixed frames, so the rules decide which frames to draw: usually one per target platform for the key screens, not every screen at every width.

## Sources

- Nielsen Norman Group, [visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/) and [principles of visual design](https://www.nngroup.com/articles/principles-visual-design/): focal points, grouping by proximity and similarity, and emphasis through scale and contrast.
- Apple, [HIG: layout](https://developer.apple.com/design/human-interface-guidelines/layout), and GOV.UK Design System, [layout](https://design-system.service.gov.uk/styles/layout/): layout derived from platform and content, reading widths, and adaptive regions.
- Carbon, [spacing](https://carbondesignsystem.com/elements/spacing/overview/): a spacing scale that expresses relationships. The reasoning is used, not IBM's values.
- W3C, WCAG 2.2 Understanding: [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): the standards behind the reflow and target-size constraints.
- The guidance on nested cards, radius by role, elevation for layering only, density trade-offs, and which frames to draw is this project's opinion.
