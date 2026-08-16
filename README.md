# DSH UO

English | [简体中文](README.zh.md)

[![CI](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/actions/workflows/ci.yml/badge.svg)](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/KaffuAlcaid/dsh-desktop-unofficial?display_name=tag)](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

DSH UO is an unofficial desktop distribution of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It packages the Harness Web UI, a pinned Harness source revision, and Node.js into one desktop application, with additional model controls and an upstream-status view.

DSH UO is an early preview, and the upstream Harness project is in developer preview. Breaking changes are possible. This project is maintained independently and is not an official DeepSeek desktop client.

## Features

- Runs the Harness Web UI in a dedicated Electron window and manages its local server process.
- Includes the required Node.js and Harness runtime in release packages. Packaged users do not need to install Node.js or pnpm.
- Adds per-model input capability controls for text-only and image-capable routes.
- Adds reasoning-effort presets, custom mappings, and Developer/System prompt-role controls for supported protocols.
- Manually compares the bundled Harness source with the official GitHub repository and shows the latest npm release of `@deepseek-ai/dsh`.

## Download

Download packages from [GitHub Releases](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases/latest).

| Platform | Package | Intended use |
| --- | --- | --- |
| Windows x64 | `DSH-UO-Setup-<version>-x64.exe` | Recommended installer; installs for all users and requests administrator approval |
| Windows x64 | `DSH-UO-<version>-win-x64.zip` | No-install archive; extract it before running |
| Linux x64 | `DSH-UO-<version>-linux-x86_64.AppImage` | Recommended Linux package |
| Linux x64 | `DSH-UO-<version>-linux-x64.zip` | Extracted application directory |

No macOS, ARM64, `.deb`, or `.rpm` package is currently published. Release artifacts are not code-signed, so Windows may show an unknown-publisher warning.

## Install and Run

### Windows x64

For the installer, run `DSH-UO-Setup-<version>-x64.exe`, approve elevation, and choose the installation directory. For the ZIP package, extract the entire archive and run `DSH-Desktop-Unofficial.exe` from the extracted directory.

The ZIP avoids installation but is not a self-contained portable profile. Settings and credentials remain in the operating system's application-data directory.

### Linux x64

The first release requires XWayland. In a Wayland session, the launcher selects XWayland by default to avoid known GPU-process crashes on some NVIDIA drivers.

Run the AppImage:

```bash
chmod +x DSH-UO-<version>-linux-x86_64.AppImage
./DSH-UO-<version>-linux-x86_64.AppImage
```

Or extract and run the ZIP package:

```bash
mkdir dsh-uo
unzip DSH-UO-<version>-linux-x64.zip -d dsh-uo
./dsh-uo/dsh-uo
```

Native Wayland is experimental. To opt in explicitly:

```bash
./DSH-UO-<version>-linux-x86_64.AppImage --ozone-platform=wayland
```

Some NVIDIA drivers may repeatedly crash the GPU process in this mode.

## First Use

1. Open **Settings → Models**, configure a provider such as DeepSeek, and save its credentials.
2. Select **Choose workspace**, add a directory that the agent may access, and select it. The session composer remains unavailable until a workspace is selected.
3. Start a session, select a configured model, and send a concrete task such as `Summarize this repository and identify its main packages.`
4. Review approval prompts before allowing file changes or command execution. Harness agents can read and edit files and run commands inside the selected workspace.

See the upstream [Web UI guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.md) and [model configuration guide](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.md) for the underlying Harness workflow.

## DSH UO Additions

The model editor adds two controls that write existing Harness and pi-ai configuration fields:

- [Input capabilities](harness-overrides/packages/client/ui-dsh-uo-model-input/README.md): automatic, text-only, or text-and-image input declarations.
- [Reasoning effort](harness-overrides/packages/client/ui-dsh-uo-reasoning-effort/README.md): provider presets, custom effort mappings, thinking formats, and prompt-role selection.

The expanded sidebar also exposes [Harness upstream status](harness-overrides/packages/client/ui-dsh-uo-upstream-status/README.md). It reports official source movement and the latest npm publication for context; it does not download or install updates.

## Updates

DSH UO has no automatic updater. Installable DSH UO updates are published only through this repository's [GitHub Releases](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases).

The upstream-status action presents three separate facts:

- the Harness source revision bundled by DSH UO;
- movement on the official GitHub default branch;
- the npm `latest` version of `@deepseek-ai/dsh`.

A newer GitHub commit or npm version does not mean a compatible DSH UO package is already available. DSH UO remains pinned until the upstream change has been reviewed and adapted.

## Data and Logs

Harness settings, credentials, sessions, and the desktop-owned default workspace are stored under the operating system's Electron user-data directory for `DSH Desktop Unofficial`. The packaged Harness home is the `dsh-home` subdirectory.

Desktop and Harness process output is written to:

```text
<system Documents directory>/DSH-UO/logs/dsh-desktop.log
```

When startup fails, the error screen shows the resolved log path.

## Known Limitations

- Windows and Linux x64 are the only packaged targets.
- Release artifacts are currently unsigned.
- App updates require a manual download from GitHub Releases.
- Linux requires XWayland by default; native Wayland remains experimental.
- Harness and DSH UO are preview software and may introduce incompatible changes.
- Upstream compatibility is tied to the repository and full commit recorded in [`upstream/harness.json`](upstream/harness.json).

## Build and Release

- [Build and develop from source](docs/building.md)
- [Maintainer release procedure](docs/releasing.md)
- [Harness override architecture](harness-overrides/README.md)

## Support

Use [this repository's issues](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/issues) for desktop packaging and DSH UO additions. Use the upstream [DeepSeek Harness discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) for questions that also reproduce in the official Harness project.

## License

DSH UO is licensed under the [MIT License](LICENSE). DeepSeek Harness and bundled third-party components retain their own copyright notices and license terms.
