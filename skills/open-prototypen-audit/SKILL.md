---
name: open-prototypen-audit
description: Independently review a rendered prototype against product and design artifacts.
metadata:
  open-prototypen-version: 0.1.0
---

# Audit

Prefer a separate agent context from the designer. Read product definition, flows, screen map, visual research, design direction, `design/system.md`, `design/system.yaml`, and rendered screens. Use `open-prototypen inspect canvas --json`, `inspect system --json`, and `validate canvas --json` for geometry and native structure. Run OpenPencil lint and the relevant color, typography, spacing, and overlap analyses when available; inspect the actual PNGs rather than treating warnings as an aesthetic score.

Examine clarity, hierarchy, UX, accessibility, coherence, and design consistency. Check that referenced token roles are visibly coherent, declared components appear as linked instances, interface icons are editable vectors with consistent alignment and weight, and represented states match the flows. Ground every finding in a screen, artifact, or inspected node. Distinguish defects from intentional, documented exceptions in `design/system.md`. Do not revise requirements to defend the prototype. Write `audit-report` using its CLI instructions and validate it. The auditor records findings; the designer, component reviewer, or refiner makes changes.
