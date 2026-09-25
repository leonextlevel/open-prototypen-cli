# Release procedure

The npm package is `open-prototypen-cli`; its executable remains `open-prototypen`. Only the root package is published. Internal workspace packages stay private.

## First release: v0.1.0

The annotated `v0.1.0` tag is local on `main`. Publishing the tag alone does not publish npm. Create the public GitHub repository `leonextlevel/open-prototypen-cli` and push `main` and `v0.1.0` when ready. The workflow checks the tag, root package version, and dated changelog section.

Before creating the GitHub Release, confirm the npm package name is still available. Publish `0.1.0` interactively from the exact `v0.1.0` checkout using an npm account with 2FA:

```sh
git switch --detach v0.1.0
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
npm login
npm publish --access public
git switch main
```

The first package version cannot use staged publishing or npm trusted publishing: [both require the package to exist on the registry](https://docs.npmjs.com/staged-publishing/). Create the GitHub Release from `v0.1.0` after the npm publish succeeds. The workflow verifies that `0.1.0` is live; it does not attempt to stage or publish that version again. Confirm `npm view open-prototypen-cli@0.1.0 version` and a clean global install. Do not move or reuse a tag after it has been pushed or published.

## Subsequent releases

Record notable changes under `[Unreleased]` in `CHANGELOG.md` in each pull request, as described in [contributing](../CONTRIBUTING.md). Wait for the maintainer's explicit completion signal before choosing a version. At that point, open a `Release vX.Y.Z` issue and a `chore/<issue>-release-vX.Y.Z` pull request that closes the changelog section with a date and updates the root version and lockfile. Run a packed-install smoke test on the branch and let CI pass. After the squash merge, create an annotated `vX.Y.Z` tag on the merge commit in `main` and push it.

For a later version, create a granular npm token with **Read and write (stage only)** access to this package, without bypass 2FA. Save it as the GitHub Actions secret `NPM_TOKEN`. Publish a GitHub Release from the version tag. The workflow uses npm 11.20.0 and runs `npm stage publish . --access public --provenance`; a successful job means the version is staged, **not yet public**. Review it with `npm stage list open-prototypen-cli`, `npm stage view <stage-id>`, and optionally `npm stage download <stage-id>`. Approve it with 2FA using `npm stage approve <stage-id>` or the npm website, then verify the live version. Staged publishing requires npm 11.15.0 or newer and Node 22.14.0 or newer. The active nvm Node 24.14.0 now has npm 11.20.0 for local review and approval. If staging fails, fix the cause and rerun the job; if the stage itself is wrong, reject it before retrying the same version.

Once `0.1.0` exists, you may replace the token with an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for `leonextlevel/open-prototypen-cli` and workflow `publish.yml`. Grant **stage-only** permission, remove `NODE_AUTH_TOKEN` from the workflow and delete `NPM_TOKEN`. Keep the approval step; the workflow already grants `id-token: write` for OIDC and provenance.
