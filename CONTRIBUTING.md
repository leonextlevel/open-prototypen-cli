# Contributing and versioning

This project is maintained by one person with agent assistance. Keep the process reviewable and small. Every change follows the same path, whether a person or an agent makes it:

1. An issue describes the problem.
2. A topic branch implements it.
3. A pull request links the issue, and CI verifies it.
4. The maintainer rebase-merges the pull request into `main`, which closes the issue.

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

- [ ] Verifiable outcomes, including tests, docs and skill updates, and a `CHANGELOG.md` entry under `[Unreleased]` that links the issue.

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

- Title it as a Conventional Commit that summarizes the change.
- Link every issue in the description with `Closes #42` when the pull request resolves it, or `Refs #42` when it only contributes. The **Issue link** check fails without a link.
- Complete the checklist in the pull request template.
- Keep the branch up to date with `main` by rebasing, not by merging `main` into it.

CI runs `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, and `npm pack --dry-run` on every pull request and on `main`. Both **CI / checks** and **Issue link / issue-link** must pass before merging. Run the same commands locally first; test the packed CLI when changing packaging or runtime asset resolution.

Pull requests are merged with **Rebase and merge**, so every commit on the branch lands on `main` as written and `main` keeps a linear history without merge commits. Each commit therefore has to stand on its own: a meaningful Conventional Commit with a `Refs:` footer that leaves the checks passing. Commit review fixes as fixups of the commit they correct, and fold them in before the merge:

```sh
git commit --fixup=<commit>
git rebase -i --autosquash origin/main
git push --force-with-lease
```

The maintainer merges approved pull requests; GitHub then deletes the branch and closes the linked issues. Rebasing gives the commits new hashes on `main`.

## Design references

The design skill keeps its procedure in `skills/open-prototypen-design/SKILL.md` and its design knowledge in focused files under `references/`, which the skill lists with when to read each one. Agents load a reference only for the decision in front of them, so keep each one short enough to read in one go, and link to another reference instead of repeating it. Keep OpenPencil and contract mechanics in `design-system.md` and `openpencil-headless.md`, and design knowledge in the topic references.

Mark every point with its guidance class, so a heuristic is never read as a rule:

- **Constraint**: checked by the CLI or by a standard such as WCAG.
- **Default**: follow it unless the product gives a reason, and record the reason.
- **Heuristic**: depends on context; weigh it.
- **Decision**: the agent's creative choice, explained in the direction or system.

End each reference with a `Sources` section that summarizes each source in the project's own words, says what the reference took from it, and separates standards from this project's opinion. Do not copy long passages. Other skills link to references by relative path, such as `../open-prototypen-design/references/design-system.md`.

## Changelog and versions

For every notable user-facing change, add a short entry under the appropriate `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, or `Security` heading in `[Unreleased]` in `CHANGELOG.md`, in the same pull request. Skip internal-only noise. Keep entries understandable without reading commits, and end each one with a full link to the issue it resolves, or several when it covers more than one; a bare `#42` is not linked in a Markdown file:

```md
- Commands run with `--json` report failures as a JSON object. ([#42](https://github.com/leonextlevel/open-prototypen-cli/issues/42))
```

Use [Semantic Versioning](https://semver.org/); before `1.0.0`, call out breaking changes clearly even when the next version is a minor increment.

Do not bump versions, move changelog entries out of `[Unreleased]`, or create release tags during ordinary work. Wait until the maintainer explicitly says a version is finished. Then open a `Release vX.Y.Z` issue and prepare the release in a `chore/<issue>-release-vX.Y.Z` pull request that chooses the next version from the accumulated changelog, updates the root package version and lockfile, and closes the changelog section. After it merges, create an annotated `vX.Y.Z` tag on the resulting commit in `main`. See [the release procedure](docs/releasing.md).
