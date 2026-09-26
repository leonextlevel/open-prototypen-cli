# OpenPencil MCP

Read this when an OpenPencil MCP server is configured in your harness. The MCP server bridges to the running OpenPencil desktop app, which edits documents in memory, measures text in auto-layout, and returns images to you. It is optional: when no server is configured, the app is closed, or it does not have the project's `.fig` open, use [the headless path](openpencil-headless.md) unchanged. The CLI's `validate canvas`, `render`, and `prototype` on the saved file remain the gates either way. Points are marked **Constraint** (checked by the CLI or a standard), **Default** (deviate with a reason), **Heuristic** (depends on context), or **Decision** (yours to make and explain). Behavior below was verified with the app and `@open-pencil/mcp` 0.15.1.

## Detect the path

- **Default.** Call `list_documents` and use MCP only when a document's `path` equals the project's `docs/design/prototype/prototype.fig`. Pass that document's `document_id` to every call, so edits never land in another open document.
- **Default.** Otherwise use the headless path. Never open, create, or save the project file from a different path through MCP.

## One writer at a time

The CLI reads and writes the file on disk (`system apply`, `ref set`, `svg import`, `eval --write`), while the app holds its own copy in memory.

- **Constraint.** Save in the app with `save_file` before running any CLI command that reads or writes the `.fig`.
- **Constraint.** After a CLI command writes the file, reopen it in the app with `close_file` and `open_file` before editing again; otherwise the app's next save overwrites the CLI's changes.
- **Constraint.** Never let the app and the CLI edit at the same time.

## What works better through MCP

- **Heuristic.** Text inside an auto-layout frame is measured: a label in an auto-layout button reported its real size and the frame hugged it, and the saved file kept those sizes. Build masters with auto-layout (`set_layout`) and let the app size their text. A standalone text node's `textAutoResize` set through MCP was not applied, so give standalone text an explicit size, as on the headless path.
- **Heuristic.** `export_image` returns a PNG (at most 1280 px on the longer edge by default) directly to you, which makes the render, critique, and refine loop from [the design review](review.md) quick. `render` is not an image export: it turns JSX into nodes.
- **Heuristic.** Node IDs stay stable during a session, also across deletions and saves, so a sequence of calls can reuse IDs it just read. The saved file still renumbers IDs, so `interactions.yaml` keeps using references.
- **Heuristic.** `get_node`, `node_bounds`, `node_bindings`, and the `analyze_*` tools give evidence for review; treat their findings as leads, not verdicts.

## What still needs the CLI or care

- **Constraint.** There is no MCP tool for shared plugin data, so assign references with `open-prototypen ref set` on the saved file, then reopen it in the app. The app keeps references it did not write: a reference set by the CLI survived an edit and save in the app.
- **Constraint.** Do not use `combine_as_variants`. It renames the masters to bare property values, such as `default` instead of `Chip/default`, which breaks the `<name>/<state>` contract that `validate canvas` checks. Keep one master per state.
- **Constraint.** The app renders families from online catalogs, but the CLI renders offline with Inter and the project fonts only: a family the app fetched is missing from `render` output unless its files are in `docs/design/assets/fonts/<Family>/<Style>.ttf` or `render --web-fonts` is used. Resolve `font-substitution` warnings from `validate canvas`.
- **Constraint.** Bind tokens with `bind_variable` only to variables that `system apply` created, and run `system apply` through the CLI, then reopen the file.

## Safety

- **Constraint.** Never print, log, or commit the MCP auth token; it changes whenever the app restarts.
- **Default.** Scope the server to the project with `OPENPENCIL_MCP_ROOT`; by default it allows the directory it was started from, which is often the whole home directory. Leave `OPENPENCIL_MCP_EVAL` off unless a task needs it, and disable remote image tools with `OPENPENCIL_MCP_DISABLED_TOOLS=stock_photo`, since the `.fig` must not depend on remote images.
- **Default.** End each MCP session when you finish. The server accepts at most ten sessions and expires idle ones only after 15 minutes, so leaked sessions lock out other clients.

## Sources

- Verified with the OpenPencil desktop app and `@open-pencil/mcp` 0.15.1 on a scratch document: text measurement, ID stability, variants saved and reloaded by the headless CLI, the lack of plugin-data tools, `export_image` output, font status in the app and in a headless export, the default root, and the session limit. These are observations of one version; re-verify after upgrading.
- OpenPencil [documentation](https://openpencil.dev/): the MCP server, its tools, and the environment variables.
