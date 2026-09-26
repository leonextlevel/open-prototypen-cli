# Intentional design

Read this before writing `design/direction.md`, and again whenever a choice feels like a default. It explains how product context becomes design consequences. It prescribes no style, palette, or layout. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Context before style

- **Default.** Before choosing anything visual, write down the context that constrains it: the primary user and their expertise, how often and how long they use the product, how much data a screen carries, what goes wrong when they make a mistake (risk and trust), platform and input method, where they use it (desk, street, noise, glare), the feeling the product should leave, accessibility needs, and which market conventions users already know.
- **Heuristic.** Differentiate where it helps the user choose or trust the product; follow conventions where users expect them, such as navigation, forms, and payment. Novelty in a convention costs learning.
- **Default.** Base the context on the product definition and research. When a point is an assumption, say so in the direction.

## Adjectives are not a direction

- **Default.** Turn every adjective into consequences someone can check in a render. "Professional" is not a direction until it becomes, for example, "restrained accent, compact density, typography-led hierarchy, and conservative motion". Another product may reasonably read "professional" as generous spacing and a warm neutral palette; the consequences, not the word, carry the decision.
- **Heuristic.** A useful direction names what the product will _not_ do, such as "no decorative imagery on task screens", because that is where generic defaults creep in.

## Archetypes are pressures, not presets

- **Heuristic.** Kinds of products push decisions in a direction: an operational tool used all day pushes toward efficiency, density, and keyboard paths; a first-run consumer onboarding pushes toward confidence, clarity, and one action at a time; a high-risk flow pushes toward explicit confirmation and recoverable errors. Use these pressures to weigh choices.
- **Default.** No industry maps to fixed colors, typefaces, or layouts. "Finance is blue" or "health is green" is a stereotype, not a reason; derive palette and type from the context above and the research.

## A design signature

- **Decision.** Derive a few recognizable characteristics from the direction, such as a typographic voice, a way of grouping content, a shape language, or a single accent used sparingly. Restraint can be one of them. Record them in the direction and apply them consistently, so the product does not converge on the look every unrelated product shares.

## Questions for generic patterns

Generated interfaces tend toward the same patterns. None is forbidden; each needs a reason from the product and direction. Ask:

- Cards inside cards: does each container group something the user thinks of as one thing?
- One radius, shadow, and spacing everywhere: do shape and space express the hierarchy, or only fill it?
- Decorative gradients, glass, or glow: what do they tell the user?
- An icon in a colored square next to every heading: does the icon add meaning the text lacks?
- Metrics, charts, or avatars with invented numbers: would the real product show them, with realistic data? Mock data should look like mock data, not like evidence.
- Several primary buttons on one screen: which action does the user most need here?
- Everything centered: does the content read better aligned to an edge?
- Copy such as "Supercharge your workflow": would a user of this product say it?

## From research to direction

- **Default.** For each visual reference, keep its source and access date, describe what is visible, name one principle that fits this product, and say what would be wrong to copy. Keep observation apart from interpretation.
- **Heuristic.** Compare references by their roles (hierarchy, navigation, content treatment, feedback), not by brand colors or surface decoration, and do not assemble an interface from unrelated screenshots.
- **Default.** Choose a few principles that answer practical questions: what deserves attention first, how dense the interface feels, and where the product is quiet or expressive. Show how each principle changes layout and components.

## Sources

- Nielsen Norman Group, [10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/): consistency with conventions users know, recognition over recall, and minimalist design that shows only relevant information inform the conventions and generic-pattern questions.
- Apple, [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/): the emphasis on clarity, deference to content, and platform conventions informs "context before style"; the guidelines are platform-specific, and this reference uses only their reasoning.
- The archetype pressures, the design signature, and the generic-pattern list are this project's own guidance, drawn from reviewing generated prototypes, not an external standard.
