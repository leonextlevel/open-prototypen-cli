---
name: open-prototypen-component-review
description: Review OpenPencil prototype screens for reuse of native design-system components, correct detached copies, and document justified one-off compositions.
metadata:
  open-prototypen-version: 0.1.0
---

# Component review

Use a separate agent context after the first screen assembly and before accepting the prototype. Read the screen map, product flows, `design/system.md`, `design/system.yaml`, and the `Design System` page in the `.fig`. Inspect every page with `open-prototypen inspect canvas --json`, the native structure with `inspect system --json`, and the rendered screens. Compare the declared component states with the native masters on `Design System` and their linked instances in screen frames. Look for repeated groups or controls that visually reproduce a master but are detached, and for reusable patterns missing from the inventory. A matching name or appearance alone does not prove an instance is linked; check its native `componentId`.

Correct the `.fig` and artifacts when needed: move missing masters and states to `Design System`, replace detached copies with linked instances, and add genuinely reusable components to `system.yaml` and the page before placing their instances. Preserve screen content, represented states, and action-node behavior; update `interactions.yaml` if a replaced node changes an action ID. Do not make a component for a composition whose specific content or behavior will not be reused. Record each such exception and its reason in `design/system.md` so later reviews can distinguish intention from drift.

After changes, run `open-prototypen inspect system --json` and `validate canvas --json`, render the affected screens, inspect their PNGs, and rebuild with `open-prototypen prototype`. Resolve validation failures and visual regressions before handing the prototype back. This review checks component use through agent judgment; the CLI's structural validation remains the compilation gate.
