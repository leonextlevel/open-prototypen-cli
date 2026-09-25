---
name: open-prototypen
description: Guide an agent through product exploration and OpenPencil prototyping in a repository initialized with Open Prototypen.
metadata:
  open-prototypen-version: 0.1.0
---

# Open Prototypen

Work from the user's idea and the project files in `docs/design/`. Run `open-prototypen status --json` to see the registered artifacts, then choose useful work based on the user's goal and current evidence. The order is yours; dependencies indicate what an artifact needs, not a mandatory phase sequence. Use `open-prototypen instructions <id> --json` before creating a registered artifact and `open-prototypen validate <id>` afterward. Read dependency documents before changing an artifact. Never replace an existing document without understanding it.

Use the mode skills when relevant: explore for an unclear idea, research for external evidence, define for product rules and flows, design for visual direction and OpenPencil work, audit for independent review, and refine for fixing findings. A discussion may be useful without creating an artifact.

The CLI handles deterministic structure. You provide reasoning, research, writing, visual choices, and review. Preserve URLs and distinguish observations, interpretation, assumptions, and mock data. Do not invent market metrics. Write project prose in the user's language; keep template headings and frontmatter keys in English.

For visual work, research the product context, explain the direction in `design/direction.md`, and record the minimum reusable system in `design/system.md` and `design/system.yaml`. Run `open-prototypen system apply` to create or synchronize the `.fig`, then build native components and linked instances before assembling screens. Use `open-prototypen inspect system --json` and `open-prototypen validate canvas --json` to check the native system. The design skill gives the detailed sequence and a reference for visual decisions.

For a navigable prototype, use `open-prototypen inspect canvas` to find frame and action-node IDs, record them in `docs/design/prototype/interactions.yaml`, run `open-prototypen render`, and then `open-prototypen prototype`. Inspect the rendered PNGs before accepting the result. Keep project prose and labels in the user's language; structural keys, native variable names, and internal instructions remain in English.
