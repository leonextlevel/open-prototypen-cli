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

### Changed

- The design skill shows how to simulate a transient failure, where a retry succeeds, and a resource conflict, whose recovery screen keeps the lost resource unavailable, with placeholder labels; the skill and `docs/interactions.md` give the same guidance on actions that share a node. ([#5](https://github.com/leonextlevel/open-prototypen-cli/issues/5))
- The audit report template has optional `Error Recovery` and `Resolution` tables: the audit skill walks every error state in the compiled prototype and reports recoveries that cannot complete the task, and the refine skill records each decision with its evidence and asks a separate context to verify critical and high findings. ([#7](https://github.com/leonextlevel/open-prototypen-cli/issues/7))
- The screen map template maps each state to its own screen key and how it is reached, and has an optional `Rule Coverage` table; product rules get stable IDs, the define skill fills both, and the audit skill walks every demonstrable rule in the prototype. ([#14](https://github.com/leonextlevel/open-prototypen-cli/issues/14))

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
