# Motion

Read this when the direction says motion matters, or before specifying a transition or animation. The prototype runtime shows static screens without transitions, so this guides the direction's optional `Motion` section and the specification, not the prototype. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Purpose

- **Default.** Give each motion a job: communicating a change of state, keeping spatial continuity between views, showing cause and effect, or confirming an action. Motion without a job is decoration that costs attention and time.
- **Decision.** Decide in the direction whether motion is part of the product's character at all; a restrained product may use almost none.

## Duration and frequency

- **Heuristic.** Keep motion brief in frequent workflows, where people repeat an action many times a day; a transition that delights once slows the hundredth time. Save longer or expressive motion for rare moments such as onboarding or completion.
- **Default.** Motion should never block input; users can act before an animation ends.

## Accessibility

- **Constraint.** Let users turn off motion triggered by interaction, and respect the system's reduced-motion preference ([WCAG 2.2, 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)). Specify the reduced alternative, such as a fade or an instant change, for each motion.
- **Default.** Never make motion the only signal of a change; the end state carries the information on its own, for people who turn motion off or miss it.
- **Constraint.** Nothing flashes more than three times per second ([2.3.1 Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)).

## In the prototype

- **Default.** Represent the start and end states as screens or variants, and describe the motion between them in the direction or in `design/decisions.md`; the runtime switches screens instantly.

## Sources

- Apple, [HIG: motion](https://developer.apple.com/design/human-interface-guidelines/motion): purposeful, brief motion that respects reduced-motion settings.
- W3C, WCAG 2.2 Understanding: [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) and [Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html): the standards behind the accessibility constraints.
- The guidance on frequency, motion as a secondary signal, restraint as character, and representing motion in the prototype is this project's opinion.
