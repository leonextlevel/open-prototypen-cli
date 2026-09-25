# Agent instructions

Open Prototypen is a skill-first, local-first CLI. Follow `docs/workflow.md` and `CONTRIBUTING.md`. Keep conceptual artifacts in Markdown under a target repository's `docs/design/`; the CLI validates structure and handles deterministic OpenPencil inspection/export and prototype compilation. Product reasoning, research, and design belong to the agent.

## Boundaries

- `packages/schemas` owns the default artifact registry and versioned templates.
- `packages/core` owns project configuration and paths; `packages/validator` owns structural checks and readiness.
- `packages/harness` installs the canonical skills in `skills/`; preserve locally edited installed skills.
- `packages/openpencil` is the only package that invokes OpenPencil. `packages/prototype` owns interactions and the static runtime.
- `apps/cli` maps these capabilities to commands; do not add reasoning phase commands.

Write tool code, skills, docs, CLI diagnostics, and structural keys in English. Write project prose in the user's language. Do not fabricate research sources or metrics. Extra artifact sections are allowed. No global project state is authoritative.

## Versioning and commits

After the initial `v0.1.0` commit, use a topic branch such as `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `refactor/<topic>`, `test/<topic>`, or `chore/<topic>`. Use Conventional Commits and record notable user-facing changes under `[Unreleased]` in `CHANGELOG.md`. Do not bump package versions, close the changelog section, or create a release tag until the maintainer explicitly says a version is finished. See `CONTRIBUTING.md` and `docs/releasing.md`.

## Verification

Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test` after changes. Test meaningful behavior with fixtures and an isolated project. Inspect renders for visual work. Keep user-owned artifacts intact on `init` and `update`.
