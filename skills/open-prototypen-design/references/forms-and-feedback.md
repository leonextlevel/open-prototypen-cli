# Forms, feedback, and empty states

Read this when designing a form, validation and errors, system status such as loading or offline, or a screen with nothing to show. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## Forms

- **Constraint.** Give every input a label or instructions that stay visible ([WCAG 2.2, 3.3.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)). A placeholder is not a label: it disappears as soon as the user types.
- **Default.** Place labels close to their controls, usually above them, so label and field read as one unit on narrow screens.
- **Default.** Add helper text only where it removes uncertainty: a format, a constraint, or why the product asks for the data.
- **Heuristic.** Choose the control from the data: radio buttons or a segmented control for a few options, which stay visible, instead of a dropdown; autocomplete for long known lists; a native date input where exact dates are entered.
- **Default.** Mark required or optional fields before any error occurs, choosing whichever is rarer in the form.
- **Heuristic.** Ask for fewer fields: prefill what the product already knows and infer what it can.

## Errors

- **Constraint.** When input is invalid, identify the field and describe the error in text ([WCAG 2.2, 3.3.1 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)), and suggest a correction when one is known ([3.3.3 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html)).
- **Default.** Put the message next to the field it concerns, and say what went wrong and how to fix it, in the user's terms.
- **Default.** Keep every valid value after an error. Clearing a form, or a card number, because one field failed makes the user start over.
- **Default.** When a form has several errors, show a summary at the top that links to each field, together with the inline messages.
- **Heuristic.** Distinguish invalid input from input that is unusual but possibly valid, such as a very high amount; warn about the second without blocking it.

## Feedback and system status

- **Default.** Represent the states the flows need: loading, success, warning, error, disabled, offline, permission denied, and partial data.
- **Default.** Show feedback near its cause and match its scope: a field error stays at the field, not in a global toast; a trivial local event does not need a page-wide alert.
- **Heuristic.** Tell users what is happening during waits longer than a moment, and what they can do while offline or without permission.

## Empty states

- **Default.** Distinguish the reasons a view is empty, because each needs a different message: first use, no data yet, filtered to zero, a search with no results, missing permission, a failed load, and deleted content.
- **Default.** Explain why the view is empty, whether that is expected, and what the user can do. Offer a call to action only when a useful next step exists; a failed load needs a retry, not "Create your first item".
- **Heuristic.** Keep illustrations secondary to the explanation; one generic illustration for every kind of emptiness hides the difference.

## In the prototype

- **Default.** Make each error, status, and empty state that the flows list a reachable screen. Use a screen variant (`base` with `overrides`) when the state differs from another screen only in text or visibility, a scenario for outcomes the product does not control, such as a failed load, and `set-state` with `when` for states the user's own actions cause. The [design skill](../SKILL.md) shows the syntax.

## Sources

- W3C, WCAG 2.2 Understanding: [Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html), [Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html), and [Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html): the standards behind the three constraints.
- GOV.UK Design System, [error summary](https://design-system.service.gov.uk/components/error-summary/), [error message](https://design-system.service.gov.uk/components/error-message/), and [validation](https://design-system.service.gov.uk/patterns/validation/): inline messages with a linked summary, and how to word them.
- Baymard Institute, research on [label position](https://baymard.com/blog/mobile-form-usability-label-position), [placeholders as labels](https://baymard.com/blog/false-simplicity), [inline validation](https://baymard.com/blog/inline-form-validation), and [preserving input after errors](https://baymard.com/blog/preserve-card-details-on-error): the defaults for labels, placeholders, and keeping input.
- Nielsen Norman Group, [error message guidelines](https://www.nngroup.com/articles/error-message-guidelines/): messages that name the problem and the recovery near the cause.
- The empty-state kinds, feedback scope, and warning rather than blocking unusual input are this project's opinion, informed by the sources above.
