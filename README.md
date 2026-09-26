# Open Prototypen CLI

Open Prototypen is a local-first CLI for agent-led product exploration and editable OpenPencil prototypes. The agent owns research and product decisions; the CLI installs skills, supplies artifact contracts, validates structure, and compiles a navigable prototype from OpenPencil frames. A dedicated component-review skill checks screen reuse and corrects detached copies before delivery.

## Install

Requires Node.js 22 or newer. The npm package is `open-prototypen-cli`; the command is `open-prototypen`.

```sh
npm install -g open-prototypen-cli
open-prototypen --version
```

## Start a project

```sh
open-prototypen --project /path/to/product init --harness codex --language pt-BR
open-prototypen --project /path/to/product status --json
open-prototypen --project /path/to/product instructions brief --json
open-prototypen --project /path/to/product validate brief --json
```

`init` creates `docs/design/config.yaml` and installs eight skills in `.agents/skills/` for Codex or `.claude/skills/` for Claude. Use `--harness all` for both. Give an agent the installed main skill path and the CLI command when its environment does not discover skills automatically. `update` refreshes unmodified installed skills while preserving local edits.

The agent writes project artifacts under `docs/design/` in the user's language. Structural keys and tool instructions stay in English. `status` reports readiness; `instructions` provides each artifact's contract and template; `validate` checks structure and dependencies. These commands and `inspect` support `--json`; with it, a failure prints `{ "error": "..." }` on stdout and exits with status 1. See [workflow principles](docs/workflow.md).

## Build a prototype

The agent researches visual references, records direction in `docs/design/design/direction.md`, explains design decisions in `docs/design/design/system.md`, and declares tokens and reusable components in `docs/design/design/system.yaml`. It then creates native OpenPencil components and instances before assembling screens.

```sh
open-prototypen --project /path/to/product system apply
open-prototypen --project /path/to/product svg import /path/to/icon.svg --name search
open-prototypen --project /path/to/product inspect system --json
open-prototypen --project /path/to/product validate canvas --json
open-prototypen --project /path/to/product inspect canvas --json
open-prototypen --project /path/to/product ref set 0:12=collection 0:15=open-detail
open-prototypen --project /path/to/product render
open-prototypen --project /path/to/product prototype
```

`system apply` creates the `.fig` when needed, synchronizes its native variables, lists as `extra` any variable in its collection that `system.yaml` no longer declares (`--prune` deletes them, refusing variables still bound to nodes unless `--force` is passed), and gives every page a neutral background apart from all token colors so frame edges stay visible. The agent builds a `Design System` page with every component master and state plus visual samples of colors, typography, and spacing, then organizes screen frames by flow on other pages. The CLI uses the pinned `@open-pencil/cli@0.15.1` for inspection and export. OpenPencil renumbers node IDs whenever nodes are added or removed, so `ref set` stores stable references in screen frames and action nodes; `interactions.yaml` uses them to define frames and node-based actions, as shown in [prototype interactions](docs/interactions.md). `render` and `prototype` reject duplicate references, targets that are not top-level frames, renders whose size differs from their frame, and hotspots outside their frame, and they warn about unreachable screens. `render` exports PNGs to `docs/design/prototype/renders/`; `prototype` writes a local site to `docs/design/prototype/dist/` that can be opened at `index.html`.

## Develop and release

```sh
pnpm install
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

See [contributing and versioning](CONTRIBUTING.md), the [changelog](CHANGELOG.md), and the [release procedure](docs/releasing.md). The package is licensed under [MIT](LICENSE).
