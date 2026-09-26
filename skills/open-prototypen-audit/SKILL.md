---
name: open-prototypen-audit
description: Independently review a rendered prototype against product and design artifacts.
metadata:
  open-prototypen-version: 0.2.0
---

# Audit

Prefer a separate agent context from the designer. Read product definition, flows, screen map, visual research, design direction, `design/system.md`, `design/system.yaml`, rendered screens, and the `Design System` page exported with `open-prototypen render --system`. Use `open-prototypen inspect canvas --json`, `inspect system --json`, and `validate canvas --json` for geometry and native structure. Run OpenPencil lint and the relevant color, typography, spacing, and overlap analyses when available; inspect the actual PNGs rather than treating warnings as an aesthetic score.

Examine clarity, hierarchy, UX, accessibility, coherence, and design consistency. Check that every state in the flows, including errors, conflicts, and deadlines, is reachable in the prototype, treating `unreachable-screen` warnings from `validate canvas` as findings. Reaching an error state is not enough: open the compiled prototype in `prototype/dist`, trigger every error, conflict, and deadline state, and follow its recovery. Fill the `Error Recovery` table with the trigger, the recovery action, the next screen or state, and whether the task can still be completed. A recovery screen that only offers going back, while the flows expect the user to finish another way, is a finding. Walk every demonstrable rule in the screen map's `Rule Coverage` table in the compiled prototype and report a rule whose expected result does not appear; require a reason for each rule marked information only. Check that referenced token roles are visibly coherent, declared components appear as linked instances, `component-screen-undeclared` and `component-unused` warnings are resolved or recorded as exceptions, interface icons are editable vectors with consistent alignment and weight, and represented states match the flows. Ground every finding in a screen, artifact, or inspected node. Distinguish defects from intentional, documented exceptions in `design/system.md`. Do not revise requirements to defend the prototype. Write `audit-report` using its CLI instructions and validate it. The auditor records findings; the designer, component reviewer, or refiner makes changes.
