# Contributing and versioning

This project is maintained by one person with agent assistance. Keep the process reviewable and small. Every change follows the same path, whether a person or an agent makes it:

1. An issue describes the problem.
2. A topic branch implements it.
3. A pull request links the issue, and CI verifies it.
4. The maintainer squash-merges the pull request into `main`, which closes the issue.

Do not push routine work directly to `main`.

## Issues

Open or find an issue before starting any implementation or fix, including documentation and skill changes. Search existing issues first (`gh issue list --state all --search "<words>"`) and comment on a duplicate instead of opening another. Small follow-ups discovered while working get their own issue unless they are required for the current one.

Write issues in English, in the terminology of the README, docs, and skills. An outside contributor must understand an issue without private context: describe behavior with a minimal example project and generic data (for example "a checkout flow where the server rejects the order"), never with a private project, internal notes, or unpublished research.

Use this structure. The issue forms provide it on GitHub; agents creating issues with `gh issue create --body-file` follow it directly:

```md
## Summary

One or two sentences.

## Problem

The current behavior and why it matters, with links to the relevant files and lines.

## Steps to reproduce

(Bugs only.) Minimal commands and inputs, with the actual and the expected result.

## Proposed solution

The concrete change: CLI flags and output, validation codes, schema fields, skill or template text.

## Alternatives considered

Brief, only when relevant.

## Acceptance criteria

- [ ] Verifiable outcomes, including tests, docs and skill updates, and a `CHANGELOG.md` entry under `[Unreleased]`.

## Scope and effort

Affected packages, skills, templates, and docs; rough effort (S/M/L); related issues and dependencies.
```

Give issues an imperative, specific title of at most about 70 characters, such as "Render only the effective hotspot when conditional actions share a node". Label them with `bug`, `enhancement`, `documentation`, or `accessibility`. Link related issues in both directions with a `Related: #12` line under **Scope and effort**, and split an issue when parts of it can ship independently.

## Branches and commits

Create branches from an up-to-date `main`, named `<type>/<issue>-<topic>`: for example `fix/42-hotspot-precedence` or `docs/57-conflict-example`. Types are `feat`, `fix`, `docs`, `refactor`, `test`, and `chore`; use lowercase words joined by hyphens.

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `feat: add ...`, `fix: correct ...`, `docs: explain ...`, with an optional scope such as `fix(openpencil): ...`. Use `!` and a `BREAKING CHANGE:` footer for incompatible public changes. Commits describe the change made, not an issue number alone; add the issue as a footer:

```text
fix(runtime): render one hotspot per action node

Refs: #42
```

## Pull requests

Open a pull request as soon as the branch has something to verify; use a draft while it is incomplete. One pull request resolves one issue, or a few issues that cannot ship separately.

- Title it as the Conventional Commit that will land on `main`, because squash merging uses it as the commit subject.
- Link every issue in the description with `Closes #42` when the pull request resolves it, or `Refs #42` when it only contributes. The **Issue link** check fails without a link.
- Complete the checklist in the pull request template.
- Keep the branch up to date with `main` and address review comments with new commits; they are squashed on merge.

CI runs `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `npm pack --dry-run` on every pull request and on `main`. Both **CI / checks** and **Issue link / issue-link** must pass before merging. Run the same commands locally first; test the packed CLI when changing packaging or runtime asset resolution.

The maintainer squash-merges approved pull requests and deletes the branch. GitHub closes the linked issues when the merge lands on `main`.

## Changelog and versions

For every notable user-facing change, add a short entry under the appropriate `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, or `Security` heading in `[Unreleased]` in `CHANGELOG.md`, in the same pull request. Skip internal-only noise. Keep entries understandable without reading commits. Use [Semantic Versioning](https://semver.org/); before `1.0.0`, call out breaking changes clearly even when the next version is a minor increment.

Do not bump versions, move changelog entries out of `[Unreleased]`, or create release tags during ordinary work. Wait until the maintainer explicitly says a version is finished. Then open a `Release vX.Y.Z` issue and prepare the release in a `chore/<issue>-release-vX.Y.Z` pull request that chooses the next version from the accumulated changelog, updates the root package version and lockfile, and closes the changelog section. After it merges, create an annotated `vX.Y.Z` tag on the merge commit. See [the release procedure](docs/releasing.md).
