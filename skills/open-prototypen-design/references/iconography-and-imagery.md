# Iconography and imagery

Read this before adding an icon or an image to a screen, or when choosing an icon family. How to import and bind icons is in [the design system reference](design-system.md). Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## When an icon helps

- **Default.** Use an icon where it speeds recognition: familiar actions with familiar metaphors (search, close, add, back), repeated items users scan, and status that pairs with text. Do not add icons for decoration beside every heading or list item.
- **Default.** Label an icon when its meaning could be ambiguous. An icon-only button is acceptable for the few actions nearly everyone recognizes; everything else gets visible text, and every icon-only action gets a `label` in `interactions.yaml`.
- **Heuristic.** Do not invent a metaphor for an abstract concept; a word is clearer than an unfamiliar symbol.

## One icon family

- **Default.** Use one family with a consistent stroke weight, fill style, optical size, corner treatment, and selected state. Mixing outline and filled icons without a rule reads as two products.
- **Default.** Draw icons at the sizes they appear, as separate masters per size (`svg import --variants`), so strokes stay crisp instead of scaling.
- **Heuristic.** Question the icon in a colored rounded square. It adds a container, a color, and a shape to every item; keep it only when the product's direction gives it a role, such as distinguishing categories users choose between.

## Imagery

- **Decision.** Give every image a stated purpose: to explain, to demonstrate, to set a tone, to establish identity, to represent real content such as products or people, or to support onboarding. An image without a purpose is space the content could use.
- **Default.** Decide the treatment once: photography or illustration, style, crop, aspect ratios, and corner treatment, and keep text on or beside images readable against them.
- **Heuristic.** Skip imagery on task screens where users came to do something, and avoid generic abstract illustrations that could belong to any product.
- **Constraint.** Never convey information only through an image; the screen's `content` in `interactions.yaml` describes what the image shows when it matters. Record the source and license of every external image, as the design system reference asks.

## Sources

- Apple, [HIG: images](https://developer.apple.com/design/human-interface-guidelines/images) and [SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols): purposeful imagery, consistent icon weight and scale, and familiar metaphors.
- Nielsen Norman Group, [icon usability](https://www.nngroup.com/articles/icon-usability/): labels for icons whose meaning is not universal.
- W3C, [WCAG 2.2, 1.1.1 Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html): the text alternative for meaningful images.
- The questions on colored icon containers, imagery purposes, and task screens are this project's opinion.
