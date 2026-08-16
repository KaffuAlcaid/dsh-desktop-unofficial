# DSH UO

[English](README.md) | 简体中文

[![CI](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/actions/workflows/ci.yml/badge.svg)](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/actions/workflows/ci.yml)
[![最新版本](https://img.shields.io/github/v/release/KaffuAlcaid/dsh-desktop-unofficial?display_name=tag)](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases/latest)
[![许可证：MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

DSH UO 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的非官方桌面发行版。它把 Harness WebUI、固定提交的 Harness 源码和 Node.js 打包为桌面应用，并补充模型设置与上游状态界面。

DSH UO 目前处于早期预览阶段，上游 Harness 也处于 developer preview 阶段，后续可能出现不兼容变更。本项目独立维护，不是 DeepSeek 官方桌面客户端。

## 功能

- 在独立 Electron 窗口中运行 Harness WebUI，并管理本地 Harness 服务进程。
- 发行包内置所需的 Node.js 和 Harness 运行时，普通用户无需安装 Node.js 或 pnpm。
- 为单个模型补充仅文本和支持图片等输入能力设置。
- 为支持的协议补充思考强度预设、自定义映射以及 Developer/System 系统提示词角色设置。
- 手动比较内置 Harness 源码与 GitHub 官方仓库，并显示 npm 上 `@deepseek-ai/dsh` 的最新发布版本。

## 下载

请从 [GitHub Releases](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases/latest) 下载发行包。

| 平台 | 发行包 | 用途 |
| --- | --- | --- |
| Windows x64 | `DSH-UO-Setup-<version>-x64.exe` | 推荐使用；按机器安装，需要管理员批准 |
| Windows x64 | `DSH-UO-<version>-win-x64.zip` | 免安装压缩包，需完整解压后运行 |
| Linux x64 | `DSH-UO-<version>-linux-x86_64.AppImage` | 推荐的 Linux 发行包 |
| Linux x64 | `DSH-UO-<version>-linux-x64.zip` | 解压后运行的应用目录 |

目前不提供 macOS、ARM64、`.deb` 或 `.rpm` 发行包。现有发行包没有代码签名，因此 Windows 可能显示未知发布者提示。

## 安装与启动

### Windows x64

使用安装器时，运行 `DSH-UO-Setup-<version>-x64.exe`，批准提权并选择安装目录。使用 ZIP 时，先完整解压，再从解压目录运行 `DSH-Desktop-Unofficial.exe`。

ZIP 可以免安装运行，但用户配置不会随程序目录移动。设置与凭据仍保存在操作系统的应用数据目录中。

### Linux x64

首个发行版要求系统提供 XWayland。处于 Wayland 会话时，启动器默认选择 XWayland，以规避部分 NVIDIA 驱动的 GPU 进程崩溃。

运行 AppImage：

```bash
chmod +x DSH-UO-<version>-linux-x86_64.AppImage
./DSH-UO-<version>-linux-x86_64.AppImage
```

也可以解压并运行 ZIP：

```bash
mkdir dsh-uo
unzip DSH-UO-<version>-linux-x64.zip -d dsh-uo
./dsh-uo/dsh-uo
```

原生 Wayland 暂为实验模式。可以显式启用：

```bash
./DSH-UO-<version>-linux-x86_64.AppImage --ozone-platform=wayland
```

部分 NVIDIA 驱动可能在此模式下反复产生 GPU 进程崩溃。

## 首次使用

1. 打开**设置 → 模型**，配置 DeepSeek 等模型提供方并保存凭据。
2. 选择**选择工作区**，添加一个允许 agent 访问的目录并选中它。选中工作区前，会话输入框不可用。
3. 创建会话，选择已经配置的模型，然后发送一个具体任务，例如：`总结这个仓库，并指出它的主要软件包。`
4. 允许修改文件或执行命令前，先检查批准提示。Harness agent 可以读取和编辑所选工作区中的文件，也可以运行命令。

Harness 本身的使用方式可以参考上游的 [WebUI 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.zh.md)和[模型配置指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.zh.md)。

## DSH UO 扩展

模型编辑器增加了两组控件，它们只写入 Harness 与 pi-ai 已有的配置字段：

- [输入能力](harness-overrides/packages/client/ui-dsh-uo-model-input/README.zh.md)：自动、仅文本、文本与图片三种输入声明。
- [思考强度](harness-overrides/packages/client/ui-dsh-uo-reasoning-effort/README.zh.md)：提供方预设、自定义强度映射、思考格式和提示词角色选择。

展开侧边栏后还可以查看 [Harness 上游状态](harness-overrides/packages/client/ui-dsh-uo-upstream-status/README.zh.md)。它提供官方源码变化和 npm 最新发布信息，不会下载或安装更新。

## 更新机制

DSH UO 没有自动更新功能。可安装的 DSH UO 更新只通过本仓库的 [GitHub Releases](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases) 发布。

上游状态入口分别展示三项信息：

- DSH UO 内置的 Harness 源码提交；
- GitHub 官方默认分支的提交变化；
- npm 上 `@deepseek-ai/dsh` 的 `latest` 版本。

GitHub 出现新提交或 npm 出现新版本，不表示已经存在兼容的 DSH UO 安装包。DSH UO 会保持固定提交，直至完成上游变更的检查和适配。

## 数据与日志

Harness 设置、凭据、会话和桌面端拥有的默认工作区，保存在操作系统中名为 `DSH Desktop Unofficial` 的 Electron 用户数据目录下。打包后的 Harness 主目录是其中的 `dsh-home` 子目录。

桌面端与 Harness 进程输出写入：

```text
<系统文档目录>/DSH-UO/logs/dsh-desktop.log
```

如果启动失败，错误界面会显示解析后的实际日志路径。

## 已知限制

- 目前只发布 Windows x64 和 Linux x64 版本。
- 发行包暂未签名。
- 应用更新需要从 GitHub Releases 手动下载。
- Linux 默认要求 XWayland，原生 Wayland 仍处于实验阶段。
- Harness 与 DSH UO 都处于预览阶段，可能出现不兼容变更。
- 上游兼容性由 [`upstream/harness.json`](upstream/harness.json) 中记录的仓库和完整提交决定。

## 构建与发布

- [从源码构建和开发](docs/building.zh.md)
- [维护者发布流程](docs/releasing.zh.md)
- [Harness 覆盖层结构](harness-overrides/README.md)

## 获取支持

桌面打包和 DSH UO 扩展的问题请提交到[本仓库 Issues](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/issues)。能够在官方 Harness 中复现的问题，请使用上游的 [DeepSeek Harness Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)。

## 许可证

DSH UO 使用 [MIT 许可证](LICENSE)。DeepSeek Harness 与发行包内的第三方组件继续保留各自的版权声明和许可条款。
