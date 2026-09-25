# Contributing and versioning

This project is maintained by one person with agent assistance. Keep the process reviewable and small.

After the initial `v0.1.0` commit, create branches from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `refactor/<topic>`, `test/<topic>`, or `chore/<topic>`. Use lowercase words joined by hyphens. Merge reviewed work back to `main`; do not do routine work directly there.

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `feat: add ...`, `fix: correct ...`, `docs: explain ...`, with an optional scope such as `fix(openpencil): ...`. Use `!` and a `BREAKING CHANGE:` footer for incompatible public changes. Commits describe the change made, not an issue number alone.

For every notable user-facing change, add a short entry under the appropriate `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, or `Security` heading in `[Unreleased]` in `CHANGELOG.md`. Skip internal-only noise. Keep entries understandable without reading commits. Use [Semantic Versioning](https://semver.org/); before `1.0.0`, call out breaking changes clearly even when the next version is a minor increment.

Do not bump versions, move changelog entries out of `[Unreleased]`, or create release tags during ordinary work. Wait until the maintainer explicitly says a version is finished. Then choose the next version from the accumulated changelog, update the root package version and lockfile, close the changelog section, verify the package, and create an annotated `vX.Y.Z` tag. The first `v0.1.0` commit and local tag are an authorized exception.

Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test` before proposing a change. Test the packed CLI when changing packaging or runtime asset resolution. See [the release procedure](docs/releasing.md).
