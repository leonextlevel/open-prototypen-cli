# Changelog

All notable user-facing changes are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `validate canvas` warns `master-label` about text on the `Design System` page that repeats a component master's name, and the design and component review skills keep text there to group headings and token sample labels. ([#29](https://github.com/leonextlevel/open-prototypen-cli/issues/29))
- `system apply` gives every page a neutral gray background slightly apart from all token colors, or the `pageBackground` declared in `system.yaml`, so screen frame edges stay visible; `validate canvas` warns `page-background` about pages that differ. ([#30](https://github.com/leonextlevel/open-prototypen-cli/issues/30))
- `interactions.yaml` accepts `scenarios` with initial values, which the prototype shows as controls in a panel beside the screens, with a Reset that restores them and returns to the initial screen; `prototype` warns `unused-scenario` and `unknown-scenario-value`. ([#6](https://github.com/leonextlevel/open-prototypen-cli/issues/6))
- `system apply` reports variables in its collection that `system.yaml` no longer declares as `extra`, and `--prune` deletes them, refusing variables still bound to nodes unless `--force` is passed; `validate canvas` warns `token-undeclared` about them. ([#8](https://github.com/leonextlevel/open-prototypen-cli/issues/8))
- `validate canvas` warns `token-label` when a text on the `Design System` page names a token followed by a value that differs from `system.yaml`, so sample labels no longer go stale silently. ([#10](https://github.com/leonextlevel/open-prototypen-cli/issues/10))
- `validate canvas` warns `component-screen-undeclared` when a component, directly or through a nested instance, appears on a screen its contract does not list, and `component-unused` when a master has no linked instance. ([#11](https://github.com/leonextlevel/open-prototypen-cli/issues/11))
- `render --page <name>` and `render --system` export whole pages, such as `Design System`, to `renders/pages/<slug>.png` on an opaque background chosen with `--background`, a canvas token, or the page background, without changing the `.fig`. ([#12](https://github.com/leonextlevel/open-prototypen-cli/issues/12))
- `validate canvas` warns `token-sample-only` when a token is bound only to samples on the `Design System` page and no component master or screen uses it. ([#13](https://github.com/leonextlevel/open-prototypen-cli/issues/13))
- `svg import` accepts `--page`, `--x`, `--y`, and `--component`: imports land on the chosen page, to the right of its content unless coordinates are given, so repeated imports no longer stack, and `--json` reports the page and position. ([#17](https://github.com/leonextlevel/open-prototypen-cli/issues/17))
- `unreachable-screen` follows `when`, `set-state`, and scenarios, so a screen reachable only through an action whose condition can never hold is reported, and `unsatisfiable-when` warns about a `when` value that nothing sets. ([#18](https://github.com/leonextlevel/open-prototypen-cli/issues/18))
- `validate canvas` warns `component-undeclared` about component masters whose name is not a `<name>/<state>` declared in `system.yaml`. ([#20](https://github.com/leonextlevel/open-prototypen-cli/issues/20))
- `status` reports per-artifact `warnings` and warns `audit-stale` when the audit report is older than the `.fig`, `system.yaml`, or `interactions.yaml`, so refine loops end with a fresh check. ([#21](https://github.com/leonextlevel/open-prototypen-cli/issues/21))
- `svg import --variants 16:color/icon/muted,24:color/accent` creates one icon master per size and color, named like `icon/check/16-muted`, rescaled and with its vector paints bound to the COLOR token. ([#22](https://github.com/leonextlevel/open-prototypen-cli/issues/22))
- `open-prototypen eval <script.js> [--write]` runs a script on the project `.fig` with helpers available as `op` (`token`, `bind`, `master`, `page`, `byRef`, `setRef`, `freeSpot`, `place`) that resolve nodes by name or reference instead of IDs that change on save. ([#23](https://github.com/leonextlevel/open-prototypen-cli/issues/23))
- A screen in `interactions.yaml` can derive from another screen with `base` and `overrides` for text and visibility; `render` applies them to a temporary copy of the `.fig`, so each state no longer needs its own cloned frame. ([#24](https://github.com/leonextlevel/open-prototypen-cli/issues/24))
- The design skill has a color reference on role-based palettes, tonal scales, accent discipline, semantic separation, WCAG contrast, and dark themes. ([#34](https://github.com/leonextlevel/open-prototypen-cli/issues/34))
- `render` loads project fonts from `docs/design/assets/fonts/<Family>/<Style>.ttf` or `.otf` without the network, `render --web-fonts` fetches missing families from web font providers, and `render` and `validate canvas` warn `font-substitution` about faces whose text would be missing from renders. ([#36](https://github.com/leonextlevel/open-prototypen-cli/issues/36))
- The design skill has a typography reference on typeface choice, hierarchy, reading comfort, numeric type, localization, and which faces render. ([#35](https://github.com/leonextlevel/open-prototypen-cli/issues/35))
- The design skill has a layout reference on layout grammar, grouping, spacing scales, hierarchy, density, radius, borders, elevation, and responsive rules, and asks for radius and elevation samples on the `Design System` page. ([#37](https://github.com/leonextlevel/open-prototypen-cli/issues/37))
- The design skill has a design review reference with questions on product fit, intentionality, genericity, cross-screen consistency, and craft; the designer critiques its renders with it before component review, the audit uses it, and the audit report has optional `Product Fit and Genericity` and `Cross-Screen Consistency` sections. ([#39](https://github.com/leonextlevel/open-prototypen-cli/issues/39))
- The design skill has an interaction-patterns reference for choosing navigation, action hierarchy, overlays, destructive-action safeguards, and collection representations, mapped to the prototype runtime. ([#40](https://github.com/leonextlevel/open-prototypen-cli/issues/40))
- The design skill has a forms-and-feedback reference covering labels, controls, errors that keep valid input, feedback scope, and empty states by reason, and the product-flows template asks for each kind of empty state. ([#41](https://github.com/leonextlevel/open-prototypen-cli/issues/41))
- The design skill has a content reference on UX writing, consistent terminology, localization-aware layout, and realistic mock data, linked from the main skill and `docs/workflow.md`. ([#42](https://github.com/leonextlevel/open-prototypen-cli/issues/42))
- The design skill has an accessibility reference with the WCAG 2.2 criteria that affect prototypes, applied while defining the system, and the audit skill explains which OpenPencil lint results to trust. ([#43](https://github.com/leonextlevel/open-prototypen-cli/issues/43))
- `prototype` and `validate canvas` warn `small-target` about action hotspots smaller than 24×24 px unless the WCAG 2.5.8 spacing exception applies, taking actions that are never active together into account. ([#45](https://github.com/leonextlevel/open-prototypen-cli/issues/45))
- `system.yaml` accepts an optional `contrast` list of color pairs with their use, and `system apply`, `inspect system`, and `validate canvas` warn `contrast-pair` when a pair falls below its WCAG 2.2 threshold. ([#46](https://github.com/leonextlevel/open-prototypen-cli/issues/46))
- `validate canvas` warns `text-contrast` about text in screens and masters below the WCAG 2.2 thresholds, including text whose fill is bound to a variable, and counts text whose background it cannot determine as unchecked. ([#47](https://github.com/leonextlevel/open-prototypen-cli/issues/47))

### Changed

- The design skill shows how to simulate a transient failure, where a retry succeeds, and a resource conflict, whose recovery screen keeps the lost resource unavailable, with placeholder labels; the skill and `docs/interactions.md` give the same guidance on actions that share a node. ([#5](https://github.com/leonextlevel/open-prototypen-cli/issues/5))
- The audit report template has optional `Error Recovery` and `Resolution` tables: the audit skill walks every error state in the compiled prototype and reports recoveries that cannot complete the task, and the refine skill records each decision with its evidence and asks a separate context to verify critical and high findings. ([#7](https://github.com/leonextlevel/open-prototypen-cli/issues/7))
- The screen map template maps each state to its own screen key and how it is reached, and has an optional `Rule Coverage` table; product rules get stable IDs, the define skill fills both, and the audit skill walks every demonstrable rule in the prototype. ([#14](https://github.com/leonextlevel/open-prototypen-cli/issues/14))
- The audit and component review skills describe the handoff when a separate review context cannot write files: the auditor returns the report for the caller to write verbatim, and the component reviewer returns an ordered change list; `docs/workflow.md` says what each review context may change. ([#15](https://github.com/leonextlevel/open-prototypen-cli/issues/15))
- The headless OpenPencil reference shows how to build auto-layout component masters with padding and gaps bound to spacing variables, and documents that hug sizing is not applied and that instances created in the same script as their master need a later save. ([#16](https://github.com/leonextlevel/open-prototypen-cli/issues/16))
- Component names in `system.yaml` may be namespaced with `/`, such as `icon/check`, so icon masters like `icon/check/16-muted` can be declared and validated; state names still cannot contain `/`. ([#19](https://github.com/leonextlevel/open-prototypen-cli/issues/19))
- The design skill lists focused references with when to read each one: a new intentional-design reference turns product context into design consequences, and the system contract, `Design System` page, components, and icons moved from `visual-system.md` to `design-system.md`. `update` removes installed skill files that are no longer shipped unless they were edited. ([#33](https://github.com/leonextlevel/open-prototypen-cli/issues/33))
- `render` no longer fetches fonts from the network by default, so renders do not depend on connectivity; pass `--web-fonts` to fetch them. ([#36](https://github.com/leonextlevel/open-prototypen-cli/issues/36))
- The design-direction template asks for the product context and the consequences of each adjective, and offers optional sections for density and composition, shape and surfaces, navigation and interaction, content voice, design signature, accessibility posture, and motion; the design-decisions template asks for the alternatives considered and the product reason. ([#38](https://github.com/leonextlevel/open-prototypen-cli/issues/38))
- The UX research template asks for the pattern decisions the product faces and the kind and strength of each source, the visual research template gives each reference an Observed, Why relevant, Principle extracted, and Do not copy block, and the research skill keeps visual inspiration apart from usability evidence. ([#44](https://github.com/leonextlevel/open-prototypen-cli/issues/44))

### Fixed

- When several active actions share a node, the prototype renders a single hotspot for the one declared last, so keyboard and screen reader users reach the same action as pointer users. ([#3](https://github.com/leonextlevel/open-prototypen-cli/issues/3))
- Keyboard focus no longer falls back to the start of the page after a prototype action: it moves to the new screen's title, stays on the hotspot after a `set-state`, and returns to the opening hotspot when an overlay closes. ([#4](https://github.com/leonextlevel/open-prototypen-cli/issues/4))
- `svg import` keeps round stroke caps and joins, so outline icons no longer render with square ends and sharp corners after saving. ([#9](https://github.com/leonextlevel/open-prototypen-cli/issues/9))

## [0.2.0] - 2026-09-25

### Added

- Organize OpenPencil screens across flow pages while inspecting, rendering, and compiling frames from every page.
- Guide agents to build a dedicated design-system page with component masters, states, and visual token samples.
- Install a component-review skill that corrects detached screen elements and records justified one-off compositions.
- Add `ref set`, `ref clear`, and `ref list` to give frames and action nodes stable references that survive OpenPencil's ID renumbering; `interactions.yaml` accepts these references and a `part` for a layer inside an instance.
- Warn about actions that can never be clicked because a later action on the same node covers them, about screens unreachable from the initial screen, text action nodes, legacy numeric node IDs, and component masters outside the `Design System` page.
- Add `placement: bottom` to `open-overlay` for bottom sheets anchored to the current screen.
- Accept `--json` on `system apply`, `svg import`, `ref`, `render`, and `prototype`.
- Show agents how to simulate conflicts and deadlines with `set-state`, `when`, and action order in the installed design skill.
- Document headless OpenPencil limits for agents: ID renumbering, unmeasured text, clipping, variable binding, fonts, icon variants, which master changes reach instances, and how to export the `Design System` page.

### Fixed

- Commands run with `--json` report failures as a JSON `{ "error": ... }` object on stdout, still exiting with status 1.
- `validate canvas` counts a component used inside another component's instance as used on that screen.
- The unmeasured-text hint and `text-action` warning appear only for text nodes that still have OpenPencil's 100×100 default size.
- Prototype overlays are modal: the screen below becomes inert, focus moves into the overlay, and Escape closes it.
- `inspect screen` names its argument `<screen>`, the screen key from `interactions.yaml`, instead of `<id>`.
- `render` no longer exports a node that is not a top-level page frame, and it keeps the previous PNG when an export fails its checks.
- `render` fails when content outside a frame enlarges the PNG, and `prototype` rejects stale renders whose size differs from their frame.
- Hotspots that extend outside their frame are rejected instead of compiled.
- `instructions` templates declare the project language instead of English.

## [0.1.0] - 2026-09-25

### Added

- Local CLI for artifact initialization, instructions, readiness, structural validation, skill updates, OpenPencil inspection and rendering, and navigable prototype compilation.
- Seven installable Codex and Claude skills for exploration, research, definition, design, audit, and refinement.
- Native design-system token synchronization, component and instance validation, and editable SVG import.
- npm packaging, MIT license, and release automation for the first public version.

[Unreleased]: https://github.com/leonextlevel/open-prototypen-cli/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/leonextlevel/open-prototypen-cli/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/leonextlevel/open-prototypen-cli/releases/tag/v0.1.0
