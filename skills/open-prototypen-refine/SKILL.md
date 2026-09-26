---
name: open-prototypen-refine
description: Resolve audit findings in design artifacts and OpenPencil screens without erasing decisions.
metadata:
  open-prototypen-version: 0.2.0
---

# Refine

Read the audit and affected product/design artifacts. Decide which findings to fix or accept explicitly, with reasons. Edit the relevant Markdown, `design/system.yaml`, and OpenPencil nodes deliberately rather than regenerating everything. When a change adds a token or reusable component, update the contract, run `open-prototypen system apply`, and update the samples and native component masters on the `Design System` page before changing linked screen instances. Keep the page's component states aligned with the inventory. Recheck SVG vectors and represented states. When you replace a screen frame or action node, give the new node the old reference with `open-prototypen ref set`, and update the text labels of changed token samples. Render, inspect, run `validate canvas --json`, and rebuild the navigable prototype after changes. Record each finding's decision, fixed or accepted, in the audit's `Resolution` table with the evidence that the rebuilt prototype resolves it, and keep unresolved critical findings visible. Update `Summary` and other statements in the report that no longer hold. Ask a separate agent context to re-check critical and high findings in the rebuilt prototype and fill "Verified by"; do not mark your own fixes as verified.
