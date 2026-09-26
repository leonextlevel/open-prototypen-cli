---
name: open-prototypen-define
description: Turn an explored idea and evidence into product definition, flows, and screen map artifacts.
metadata:
  open-prototypen-version: 0.2.0
---

# Define

Read the brief and relevant research. Use `open-prototypen instructions <id> --json` for product-definition, product-flows, and screen-map. Make actors, capabilities, product rules, entry points, success and failure paths explicit. Give each product rule a stable ID such as `R1`. In the screen map, give every state with a distinct visual response, such as an error or an empty list, its own screen key matching `^[a-z][a-z0-9-]*$`, and say how it is reached; `system.yaml` and `interactions.yaml` use these keys later. Add a `Rule Coverage` table that says, for each rule, which screen key and action demonstrate it and the expected result, or why it stays information only. Record major tradeoffs in product-decisions when useful. Preserve open questions and label assumptions; do not silently convert them into requirements. Validate each artifact before building on it.
