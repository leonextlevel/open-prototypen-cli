# Agent instructions

Open Prototypen is a skill-first, local-first CLI. Follow `docs/workflow.md` and `CONTRIBUTING.md`. Keep conceptual artifacts in Markdown under a target repository's `docs/design/`; the CLI validates structure and handles deterministic OpenPencil inspection/export and prototype compilation. Product reasoning, research, and design belong to the agent.

## Boundaries

- `packages/schemas` owns the default artifact registry and versioned templates.
- `packages/core` owns project configuration and paths; `packages/validator` owns structural checks and readiness.
- `packages/harness` installs the canonical skills in `skills/`; preserve locally edited installed skills.
- `packages/openpencil` is the only package that invokes OpenPencil. `packages/prototype` owns interactions and the static runtime.
- `apps/cli` maps these capabilities to commands; do not add reasoning phase commands.

Write tool code, skills, docs, CLI diagnostics, and structural keys in English. Write project prose in the user's language. Do not fabricate research sources or metrics. Extra artifact sections are allowed. No global project state is authoritative.

## Issues, pull requests, and versioning

Every implementation or fix starts from a GitHub issue and lands through a pull request; do not push to `main`. Name branches `<type>/<issue>-<topic>` (for example `fix/42-hotspot-precedence`), use Conventional Commits with a `Refs: #<issue>` footer and keep each commit self-contained, since pull requests are rebase-merged, and put `Closes #<issue>` in the pull request description. Write issues in English with the structure in `CONTRIBUTING.md`, generic reproducible examples, and no private project data. Record notable user-facing changes under `[Unreleased]` in `CHANGELOG.md` in the same pull request, ending each entry with a full Markdown link to its issue, for example `([#42](https://github.com/leonextlevel/open-prototypen-cli/issues/42))`. Do not bump package versions, close the changelog section, or create a release tag until the maintainer explicitly says a version is finished. See `CONTRIBUTING.md` and `docs/releasing.md`.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test` after changes; CI repeats them on every pull request. Test meaningful behavior with fixtures and an isolated project. Inspect renders for visual work. Keep user-owned artifacts intact on `init` and `update`.
