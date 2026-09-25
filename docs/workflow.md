# Workflow principles

Open Prototypen separates agent judgment from CLI infrastructure. Agents research, decide, and design. The CLI manages contracts, local assets, structural validation, OpenPencil inspection and export, and prototype compilation. Artifact dependencies show readiness without prescribing a fixed phase order.

`docs/design/` is the project workspace. Markdown holds briefs, research, product decisions, design direction, and audits so they remain useful and editable without this tool. YAML holds machine-oriented contracts such as project configuration, design tokens and component inventory, and interactions. The `.fig` remains the editable visual source; PNGs and HTML are outputs.

Research must name sources and separate observed facts, third-party claims, interpretations, assumptions, and recommendations. Agents must not invent market size, usage, revenue, or performance metrics. Prototype sample content should be recognizable as mock data.

Validation checks parseability, frontmatter, required sections, dependencies, declared design-system values, and measurable canvas properties. It does not rate the quality of an idea or impose prose length or a visual style. Extra artifact sections and manual edits are welcome. Audit visual quality through rendered screens and the `.fig` structure, documenting corrections and justified exceptions.

The tool runs locally and does not provide cloud collaboration, an account service, a vector editor, or production frontend generation. Agent skills provide the design process; the CLI stays deterministic and usable across agent harnesses.
