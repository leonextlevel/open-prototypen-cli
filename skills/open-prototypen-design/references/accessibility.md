# Accessibility

Read this while defining the system and composing screens, not only before the audit: contrast, focus, and target size are cheap to get right in the foundations and costly to fix later. It lists the WCAG 2.2 criteria that affect visual prototypes and their design consequences. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Contrast and color

- **Constraint.** Text needs at least 4.5:1 against its background, and large text (at least 24 px, or 18.66 px bold) at least 3:1 ([1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).
- **Constraint.** Meaningful non-text UI, such as input borders, focus indicators, meaningful icons, and chart marks, needs at least 3:1 against adjacent colors ([1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- **Constraint.** Never convey meaning by color alone ([1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)). Choosing the palette is covered in [color](color.md).

## Focus

- **Constraint.** Every interactive element needs a visible focus indicator ([2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)).
- **Default.** Aim for the stronger [2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) (AAA): an indicator at least as large as a 2 px perimeter around the element, with 3:1 contrast between its focused and unfocused states.
- **Default.** Design a focus treatment for each interactive component, and show it as a state on the `Design System` page when the prototype is used with a keyboard. The prototype runtime draws its own focus ring on hotspots, so the screens themselves need not show focus.

## Target size

- **Constraint.** Interactive targets are at least 24 by 24 CSS px, or spaced so that a 24 px circle centered on each does not overlap another target; inline links in text and targets whose size the platform fixes are exempt ([2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).
- **Default.** For touch, aim for 44 by 44 px ([2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)). The visible icon can be smaller than its hit area: give the action node a transparent hit area of the target size. `prototype` and `validate canvas` warn `small-target` about hotspots under 24 px that the spacing exception does not cover; 44 px stays a design goal, not a check.

## Reflow and text size

- **Constraint.** Content must reflow at 320 CSS px wide without horizontal scrolling ([1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)), and text must stay usable when enlarged to 200 % ([1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)). Leave room for wrapping instead of fitting labels exactly; see [layout](layout.md).

## Forms

- **Constraint.** Inputs need visible labels or instructions, and errors need identification in text and, when known, a suggestion. Details are in [forms and feedback](forms-and-feedback.md).

## Motion

- **Default.** Respect the reduced-motion preference, and never use motion as the only signal of a change ([2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)). Prototypes are static, so record any intended motion and its reduced alternative in the direction.

## The prototype's text alternative

- **Constraint.** In `interactions.yaml`, each screen's `title` and `content` and each action's `label` are the only text screen readers get, because the PNG has none. Write `content` as a real description of everything meaningful on the screen, including state and data, and labels as the action's outcome; `prototype` rejects empty ones.

## What the CLI checks

- `validate canvas` and `prototype` check structure: labels exist, hotspots lie inside frames, and screens are reachable. `small-target` covers the 24 px minimum for action hotspots, and `contrast-pair` the declared color pairs in `system.yaml`. Contrast, focus appearance, and reflow need visual review of the renders unless a CLI warning covers them.
- OpenPencil's own lint has limits in this workflow. Its `color-contrast` rule skips text whose fill is bound to a variable, which is how this workflow builds screens, always requires 4.5:1 even for large text, and only compares against ancestors' fills. Its `touch-target-size` rule matches layer names and asks for 44 by 44 px, which is the enhanced level, and knows nothing of the prototype's action nodes. Treat its reports as leads to verify, and its silence as no evidence.

## Sources

- W3C, [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and its Understanding documents linked above: every threshold and constraint in this reference.
- Apple, [HIG: accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): the 44 pt comfortable touch target and reduced motion.
- The limits of OpenPencil's lint rules were read from `@open-pencil/core` 0.15.1. Applying these criteria while designing rather than at audit time is this project's opinion.
