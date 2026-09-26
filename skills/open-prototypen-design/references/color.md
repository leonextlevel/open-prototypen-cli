# Color

Read this when choosing palette roles, building color scales, placing the accent, adding a dark theme, or checking contrast. It explains reasoning, not a house palette: no industry maps to fixed colors. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Roles first

- **Default.** Start from the roles the product needs, not from swatches: canvas, surface, raised surface, primary and secondary text, border, interactive border, accent and text on the accent, link, focus, selection, success, warning, danger, information, disabled, and data colors for charts. Skip roles no screen uses.
- **Default.** Name tokens by role (`color/text/secondary`), not by hue (`color/gray-600`). The role is what a reviewer checks and what survives a palette change.

## Building a palette

- **Default.** Build a neutral family, an accent family, and one family per semantic role as tonal scales: steps of the same hue from light to dark. Add visualization colors only when the product shows data.
- **Heuristic.** Build the steps in a perceptual color space such as OKLCH. Equal steps of OKLCH lightness look like equal steps to the eye, while equal steps in RGB or HSL do not, so text and border steps stay predictable across hues.
- **Heuristic.** Give each step a purpose instead of picking values ad hoc: the lightest steps for app and component backgrounds, middle steps for borders and hover states, the most saturated step for solid fills such as a primary button, and the darkest steps for text. Then map roles to steps, for example `surface` to step 2 and `text/secondary` to step 11 of the same scale.
- **Heuristic.** Tint neutrals slightly toward the accent hue instead of defaulting to pure gray; a trace of the accent in grays makes the palette read as one family. Pure gray is a valid decision for a deliberately technical look.
- **Default.** Keep large backgrounds calm even when the brand color is saturated. A saturated canvas competes with content and makes every other color harder to read.

## Accent discipline

- **Default.** Treat the accent as limited attention. Reserve it for primary actions, the current selection, meaningful highlights, and deliberate brand moments. When headings, icons, borders, and badges all carry the accent, nothing stands out, and the primary action loses its signal.
- **Heuristic.** Count accented elements on each rendered screen. More than a few usually means some should move to neutral text or borders.

## Semantic separation

- **Default.** Keep brand, success, warning, danger, and information visibly distinct. A green brand color cannot double as success, nor a blue brand as information: users read the color as a status.
- **Constraint.** Never convey meaning by color alone; pair it with text, an icon, or a shape, so the state survives color blindness, grayscale, and glare ([WCAG 2.2, 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)).

## Contrast

- **Constraint.** Text needs a contrast ratio of at least 4.5:1 against its background, and large text (at least 24 px, or 18.66 px bold) at least 3:1 ([WCAG 2.2, 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- **Constraint.** Meaningful non-text UI, such as input borders, focus indicators, icons that carry meaning, and chart elements, needs at least 3:1 against adjacent colors ([WCAG 2.2, 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Disabled controls are exempt, but should still read as present.
- **Default.** Check the real pairs the screens use, including text on the accent, secondary text on raised surfaces, and placeholder text, not only the main text on the canvas. Record intentional exceptions in `system.md`.

## Dark themes

- **Default.** Design a dark theme from the roles, not by inverting the light one. Surfaces get lighter as they rise, because shadows are barely visible on dark backgrounds.
- **Heuristic.** Reduce saturation of accents and semantic colors on dark surfaces, where saturated colors vibrate and glare. Avoid pure white text on pure black for long reading; slightly off-white on a very dark gray reduces glare.
- **Default.** Re-check every pair: semantic colors usually need lighter steps on dark surfaces to keep contrast, and borders need their own values.

## Tokens

- **Heuristic.** Distinguish primitive values (the steps of a scale) from semantic role tokens (`color/surface`, `color/accent`). Bind the semantic tokens in masters and screens, so a palette change touches the roles, not every node.
- **Constraint.** `system.yaml` is a flat list of OpenPencil variables. When you keep primitives, declare them as their own tokens; a semantic variable cannot reference a primitive, so repeat the value and keep the two in sync. See [the design system reference](design-system.md) for the contract.

## Sources

- W3C, [WCAG 2.2 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/): [Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), and [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) are the standard behind every contrast threshold and the color-alone rule.
- W3C, [CSS Color 4: OKLab and OKLCH](https://www.w3.org/TR/css-color-4/#ok-lab): defines the perceptual space recommended for scales.
- Radix, [understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale): the idea of scale steps with fixed purposes (backgrounds, borders, solids, text).
- [Carbon](https://carbondesignsystem.com/elements/color/overview/), [Fluent 2](https://fluent2.microsoft.design/color), and [Atlassian](https://atlassian.design/foundations/color) color guidance: role-based tokens, semantic families, and dark-theme elevation. The reasoning is used, not their values.
- Apple, [HIG: color](https://developer.apple.com/design/human-interface-guidelines/color): semantic colors and dark mode adaptation.
- Accent discipline, counting accented elements, and neutrals tinted toward the accent are this project's opinion, informed by the systems above.
