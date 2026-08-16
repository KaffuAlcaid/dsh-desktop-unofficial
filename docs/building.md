# Build DSH UO from Source

English | [简体中文](building.zh.md)

These instructions are for contributors and maintainers. Users of a packaged release do not need Node.js, pnpm, or a Harness source checkout.

## Prerequisites

- Git
- A Node.js version accepted by the `engines` field in [`package.json`](../package.json)
- Corepack with the pnpm version declared by `packageManager`
- Network access for the pinned Harness source, npm dependencies, Electron, and the packaged Node.js runtime
- Windows x64 to build Windows packages, or Linux x86_64 to build Linux packages

The repository pins the upstream repository, source commit, package manager, and compatible Node.js range in [`upstream/harness.json`](../upstream/harness.json). Do not substitute the npm `latest` package for the pinned source checkout.

## Windows Development

Install the desktop dependencies and prepare the pinned Harness worktree:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run prepare:harness

Push-Location .build\deepseek-harness
corepack pnpm install --frozen-lockfile
Pop-Location
```

Build Harness, build the Electron host, and start the desktop application:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\dev.ps1
```

`dev.ps1` expects the prepared Harness worktree and its dependencies to exist. It rebuilds Harness before starting Electron.

## Linux Development

Install dependencies and prepare the Linux Harness worktree:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run prepare:harness:linux

cd .build/deepseek-harness-linux
corepack pnpm install --frozen-lockfile
corepack pnpm run build
cd ../..
```

Point the Electron host at that worktree and start it:

```bash
DSH_DESKTOP_HARNESS_DIR=.build/deepseek-harness-linux corepack pnpm run dev
```

## Build Release Packages

Build the Windows ZIP and NSIS installer on Windows x64:

```powershell
corepack pnpm install --frozen-lockfile
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-portable.ps1 -Target all
```

Build the Linux ZIP and AppImage on Linux x86_64:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run package:portable:linux
```

Both packaging scripts prepare the pinned Harness source and install missing dependencies when needed. They build Harness, stage a standalone runtime under `resources/runtime`, bundle Node.js, and write artifacts to `release/`.

Generated source worktrees, caches, staged runtime files, and release output are ignored by Git. The preparation scripts refuse to overwrite an existing prepared worktree; follow the removal command printed by the script when a new pinned source revision must be prepared.

## Repository Layout

- [`src/`](../src): Electron main process, preload bridge, Harness process management, logging, and upstream checks.
- [`harness-overrides/`](../harness-overrides): DSH UO plugins and patches applied to the pinned official source.
- [`scripts/`](../scripts): source preparation, runtime staging, and cross-platform packaging.
- [`upstream/harness.json`](../upstream/harness.json): authoritative upstream source pin and toolchain metadata.
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): packaged-runtime verification on Windows and Linux.

See the [Harness override documentation](../harness-overrides/README.md) before changing a patch or injected package.
