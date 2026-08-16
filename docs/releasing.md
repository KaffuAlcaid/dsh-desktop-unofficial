# Release DSH UO

English | [简体中文](releasing.zh.md)

This procedure is for project maintainers. A tag matching the package version triggers [the release workflow](../.github/workflows/release.yml), which builds and publishes all four supported artifacts.

## 1. Prepare the Release Commit

1. Update `version` in [`package.json`](../package.json).
2. Confirm that [`upstream/harness.json`](../upstream/harness.json) contains the intended official repository, npm package name, full source commit, source version, package manager, and Node.js range.
3. Confirm that every patch under [`harness-overrides/patches`](../harness-overrides/patches) applies to the pinned commit and that the injected packages describe their current behavior.
4. Check that README package names, supported platforms, and limitations still match [`electron-builder.yml`](../electron-builder.yml) and the release workflow.
5. Keep the release commit free of generated `.build`, `resources/runtime`, and `release` output.

The npm `latest` version is informational. Do not change the source pin merely to make its version string match npm; review and adapt the corresponding official source first.

## 2. Validate on `main`

Push the release commit to `main` and wait for [CI](../.github/workflows/ci.yml) to pass. The CI workflow:

- builds the Windows x64 ZIP and NSIS installer;
- checks the Windows packaged runtime and bundled DSH command;
- builds the Linux x64 ZIP and AppImage;
- starts the packaged Linux desktop under Xvfb and waits for the Web UI;
- checks archive contents and the embedded Harness manifest.

Do not create the release tag from a commit whose Windows or Linux job is failing.

## 3. Create the Tag

The tag must be exactly `v` followed by the `package.json` version:

```bash
version="$(node -p "require('./package.json').version")"
git tag -a "v$version" -m "DSH UO v$version"
git push origin "v$version"
```

The workflow rejects a tag/version mismatch and a Harness manifest without a full Git commit or npm package name.

If an existing tag needs another publish attempt, open **Actions → Build and Release → Run workflow** and enter that tag, for example `v0.1.0`. The manual run checks out the specified tag and uploads the rebuilt assets to its existing Release.

## 4. Verify the GitHub Release

The completed workflow must publish exactly these files:

| Platform | Expected artifact |
| --- | --- |
| Windows x64 | `DSH-UO-<version>-win-x64.zip` |
| Windows x64 | `DSH-UO-Setup-<version>-x64.exe` |
| Linux x64 | `DSH-UO-<version>-linux-x64.zip` |
| Linux x64 | `DSH-UO-<version>-linux-x86_64.AppImage` |

Confirm that the release title and tag use the same version. Add the exact bundled Harness source version and full commit to the release notes, together with user-visible changes and known limitations. The generic README intentionally avoids hard-coding those release-specific values.

The workflow does not currently produce code signatures or checksum files. Do not describe the artifacts as signed or checksummed.

## 5. Test the Published Downloads

Use files downloaded from the GitHub Release rather than local `release/` output:

1. Install the Windows setup package and launch its shortcut.
2. Extract the Windows ZIP to a separate directory and launch its executable.
3. Mark the Linux AppImage executable and launch it in the supported XWayland path.
4. Extract the Linux ZIP and launch `dsh-uo`.
5. On each available platform, confirm that the Web UI loads, a model can be configured, a workspace can be selected, and the bundled Harness version command succeeds where the workflow exposes it.
6. Open the upstream-status action and confirm that GitHub source status and the npm publication are presented separately from DSH UO updates.

If a published release needs a corrective build, make the fix on `main`, choose a new package version, and publish a new tag. Do not move an already published tag to a different commit.
