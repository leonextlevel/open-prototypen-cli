# Release procedure

The npm package is `open-prototypen-cli`; its executable remains `open-prototypen`. Only the root package is published. Internal workspace packages stay private.

## First release: v0.1.0

The initial commit and annotated `v0.1.0` tag are created locally on `main`. Publishing the tag alone does not publish npm. Create the public GitHub repository `leonextlevel/open-prototypen-cli`, push `main` and `v0.1.0`, then publish a GitHub Release using the existing tag when ready. The workflow checks the tag, root package version, and dated changelog section before publishing.

Before publishing the GitHub Release, confirm the npm package name is still available. Create an npm granular access token with package read/write (publish and stage) and bypass 2FA enabled, restricted to the minimum practical scope and lifetime. Add it as the GitHub Actions secret `NPM_TOKEN`. The first package version cannot use npm trusted publishing: [npm requires an existing package before trust can be configured](https://docs.npmjs.com/cli/v11/commands/npm-trust/). A granular token supports the first non-interactive publish from Actions; [direct token publishing is being deprecated](https://docs.npmjs.com/about-access-tokens/), so remove it after bootstrapping.

The published GitHub Release triggers `.github/workflows/publish.yml`. Watch its checks and confirm `npm view open-prototypen-cli@0.1.0 version` and a clean global install afterward. If a release job fails, fix the cause and rerun the job; do not move or reuse a published version tag for different code.

## Subsequent releases

Record notable changes under `[Unreleased]` in `CHANGELOG.md` while developing on topic branches. Wait for the maintainer's explicit completion signal before choosing a version. At that point, close the changelog section with a date, update the root version and lockfile, run checks and a packed-install smoke test, merge to `main`, and create an annotated `vX.Y.Z` tag. Publish a GitHub Release from that tag to run the workflow.

After `0.1.0` exists on npm, configure `leonextlevel/open-prototypen-cli` and workflow filename `publish.yml` as an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/), allowing direct publish. Remove `NODE_AUTH_TOKEN` from the publish step and delete the `NPM_TOKEN` GitHub secret. The workflow already grants `id-token: write` for OIDC and provenance. Verify the first OIDC release before considering the migration complete.
