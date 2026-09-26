---
artifact: audit-report
version: 1
status: draft
language: en
dependsOn:
  - screen-map
  - design-direction
  - design-system
---

# Audit Report

## Summary

TODO: State which screens, rendered PNGs, product flows, and native `.fig` structure were reviewed, and the main outcome.

## Critical Findings

TODO: List blocking issues with precise screen or node evidence, or state that none were found.

## UX Findings

TODO: Check navigation, task completion, empty/error/selected states, and action feedback against the flows.

## Visual Findings

TODO: Review hierarchy, typography, spacing, alignment, contrast, icons, and product fit from the exported images, using the design skill's review questions.

## Product Fit and Genericity

TODO: Optional. Record where the screens serve or miss this product's context, and generic patterns that neither the product nor the direction justifies, with the "why this?" answers found or missing.

## Cross-Screen Consistency

TODO: Optional. Record drift between screens: action hierarchy, terminology, density, the look of equivalent states, and the design signature.

## Native System Findings

TODO: Compare `design/system.yaml` with native variables, bindings, components, state components, and linked instances. Note relevant OpenPencil lint/analysis results and visually verified exceptions.

## Accessibility Findings

TODO: Review text legibility, contrast, focus cues, target size, icon meaning, and the prototype's screen/action descriptions.

## Error Recovery

TODO: Optional. For every error, conflict, and deadline state in the flows, walk the compiled prototype in `prototype/dist` and record whether the user can still complete the task. Report a recovery that cannot be completed as a finding.

| Error | Trigger | Recovery action | Next screen or state | Task can be completed |
| ----- | ------- | --------------- | -------------------- | --------------------- |

## Accepted Exceptions

TODO: Record intentional deviations and why they are acceptable, with supporting evidence; do not use this section to hide unresolved critical issues.

## Resolution

TODO: Optional; filled during refine. Record each finding's decision and the evidence that the rebuilt prototype resolves it. A separate context re-checks critical and high findings and fills "Verified by".

| Finding | Decision (fixed / accepted) | Verification evidence | Verified by |
| ------- | --------------------------- | --------------------- | ----------- |
