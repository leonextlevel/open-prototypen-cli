# Content

Read this when writing interface text, naming things across screens, laying out for other languages, or filling screens with mock data. Project prose stays in the user's language. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain).

## UX writing

- **Default.** Write clear, short, specific, human, and actionable text. Say what the user gets or must do, in their words.
- **Default.** Front-load headings with the words users scan for, and label buttons with their outcome, such as "Save draft" rather than "Submit".
- **Default.** Write errors that say what happened and what to do next, without blame or jargon; see [forms and feedback](forms-and-feedback.md).
- **Default.** Use one term per concept on every screen, in navigation, headings, buttons, and messages. If a "project" is a "workspace" on another screen, users wonder whether they are two things.
- **Heuristic.** Question filler phrases that fit any product: "Unlock the power of", "Seamlessly", "Everything you need", "Supercharge", "Take it to the next level", "Welcome back!" on every screen. Replace them with what this product does for this user, or remove them.

## Voice

- **Decision.** Take the product's voice from the direction's optional `Content Voice` section, and keep it consistent in headings, empty states, and errors. When the direction has none, write plainly and neutrally rather than inventing a personality.

## Localization

- **Default.** Plan for translations that run longer and wrap, for accented characters and diacritics, for plural forms, and for locale formats of dates, numbers, and currency, such as `1.234,56 €` beside `€1,234.56`. Do not fix geometry to one language's label lengths.
- **Heuristic.** Consider right-to-left layout when the product targets such languages; it mirrors navigation, icons with direction, and alignment.

## Realistic mock content

- **Default.** Shape mock data like the domain: short and long values, missing optional values, unusual names, several statuses, realistic timestamps and amounts, and realistic list lengths rather than three tidy rows with round numbers. Generic data leads to generic layouts, because it hides wrapping, overflow, and empty fields.
- **Default.** Keep mock data recognizable as fictional where it could be mistaken for real data, such as people, companies, and account numbers.
- **Constraint.** Never present invented market, usage, revenue, or performance metrics as facts, on screens or in artifacts; this is a rule of the Open Prototypen workflow.

## Edge cases as design cases

- **Decision.** Choose the non-happy content that materially changes the experience, such as a very long name, an overflowing list, partial data, or a missing image, and design those cases on the screens where they occur. Do not draw every theoretical state on every screen.

## Sources

- GOV.UK Service Manual, [writing for user interfaces](https://www.gov.uk/service-manual/design/writing-for-user-interfaces): short, specific, front-loaded text in the user's words.
- Nielsen Norman Group, [error message guidelines](https://www.nngroup.com/articles/error-message-guidelines/): errors that name the problem and the recovery.
- Apple, [HIG: writing](https://developer.apple.com/design/human-interface-guidelines/writing): outcome-based labels, consistent terms, and a consistent voice.
- The filler-phrase list, the mock-data guidance, and the choice of edge cases are this project's opinion; the rule against invented metrics comes from Open Prototypen's workflow principles.
