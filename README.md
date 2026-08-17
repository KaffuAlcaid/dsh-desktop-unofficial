# DSH UO

[English](README.en.md) | 简体中文

[![CI](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/actions/workflows/ci.yml/badge.svg)](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/actions/workflows/ci.yml)
[![最新版本](https://img.shields.io/github/v/release/KaffuAlcaid/dsh-desktop-unofficial?display_name=tag)](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases/latest)
[![许可证：MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## 项目介绍

DSH UO 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的非官方桌面发行版。发行包将 Harness WebUI、固定提交的 Harness 源码和 Node.js 运行时打包在一起，安装后即可作为桌面应用使用。

DSH UO 还增加了模型输入能力、思考强度、系统提示词编辑和 Harness 上游状态等界面。项目目前处于早期预览阶段，上游 Harness 也处于开发者预览阶段，后续版本可能包含不兼容变更。本项目由社区独立维护，不是 DeepSeek 官方桌面客户端。

## 界面预览

![DSH UO 主界面](docs/images/overview.png)

模型输入能力和思考强度设置：

![DSH UO 模型输入能力和思考强度设置](docs/images/model-controls.png)

Harness 上游状态：

![DSH UO Harness 上游状态](docs/images/upstream-status.png)

## 下载

普通用户请从 [GitHub Releases](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases/latest) 下载发行包，无需从源码构建。Releases 页面自动生成的 `Source code (zip)` 和 `Source code (tar.gz)` 只是项目源码，不能作为桌面应用直接启动。

| 平台 | 发行包 | 适用方式 |
| --- | --- | --- |
| Windows x64 | `DSH-UO-Setup-<version>-x64.exe` | 推荐；安装到系统并创建快捷方式 |
| Windows x64 | `DSH-UO-<version>-win-x64.zip` | 免安装；完整解压后运行 |
| Linux x64 | `DSH-UO-<version>-linux-x86_64.AppImage` | 推荐的 Linux 发行包 |
| Linux x64 | `DSH-UO-<version>-linux-x64.zip` | 解压后运行的应用目录 |

中国大陆部分网络环境访问 GitHub Releases 可能较慢。目前项目没有官方国内镜像或备用下载站，GitHub Releases 是唯一官方发布来源。请不要从来路不明的网盘、代理站或重新打包页面下载程序。

目前不提供 macOS、ARM64、`.deb` 或 `.rpm` 发行包。

## Windows 安装与未签名提示

使用安装器时，运行 `DSH-UO-Setup-<version>-x64.exe`，批准管理员权限请求，然后选择安装目录。安装完成后可从桌面或开始菜单启动 DSH UO。

使用 ZIP 时，先将压缩包完整解压到一个普通目录，再从该目录运行 `DSH-Desktop-Unofficial.exe`。不要直接在压缩包预览窗口内运行，也不要只复制其中的 EXE 文件。ZIP 版本无需安装，但设置、凭据和会话仍保存在 Windows 的应用数据目录中，不会跟随程序目录移动。

当前 Windows 安装包和可执行文件没有代码签名，因此 Windows 可能显示“未知发布者”，Microsoft Defender SmartScreen 也可能阻止首次启动。确认文件来自本仓库的 GitHub Releases 页面后，可以在 SmartScreen 窗口中选择“更多信息”，再选择“仍要运行”。不同 Windows 版本的文字可能略有差异。

如果下载来源不确定，或文件名与 Releases 页面列出的发行包不一致，请取消运行并重新从官方 Releases 页面下载。无需关闭 SmartScreen 或其他系统安全功能。

## Linux 安装

当前 Linux 版本默认通过 XWayland 启动，以规避部分 NVIDIA 驱动下的 GPU 进程崩溃。

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

原生 Wayland 暂为实验模式，可以显式启用：

```bash
./DSH-UO-<version>-linux-x86_64.AppImage --ozone-platform=wayland
```

部分 NVIDIA 驱动可能在此模式下反复出现 GPU 进程崩溃。

## 首次使用

1. 打开“设置 → 模型”，选择模型提供方，填写 API 密钥并保存。需要时可修改 API 地址和模型目录。
2. 在主界面选择工作区，添加并选中一个允许 Agent 访问的目录。选中工作区前，会话输入框不可用。
3. 选择需要的 Agent 预设。首次使用可保留默认的“标准模式”。
4. 新建会话，选择已经配置的模型，然后发送一个具体任务，例如：`总结这个仓库，并指出它的主要软件包。`
5. 允许修改文件或执行命令前，先检查批准提示。Harness Agent 可以读取和编辑所选工作区中的文件，也可以运行命令。

Harness 的基础操作可参考上游的 [WebUI 指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/index.zh.md)和[模型配置指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/providers.zh.md)。

## DSH UO 增加的功能

- [模型输入能力](harness-overrides/packages/client/ui-dsh-uo-model-input/README.zh.md)：为单个模型选择自动、仅文本或文本与图片输入。
- [思考强度](harness-overrides/packages/client/ui-dsh-uo-reasoning-effort/README.zh.md)：提供不同模型服务的预设、自定义强度映射、思考格式和提示词角色设置。
- [系统提示词编辑器](harness-overrides/packages/client/ui-dsh-uo-system-prompt/README.zh.md)：从标准模式创建用户 Agent 预设，并编辑角色设定（persona）的系统提示词；保存结果从之后新建的会话开始生效。
- [Harness 上游状态](harness-overrides/packages/client/ui-dsh-uo-upstream-status/README.zh.md)：在桌面端侧边栏中显示内置 Harness 提交、官方仓库变化和 npm 最新版本。此功能只提供信息，不会下载或安装更新。

这些设置沿用 Harness 与 pi-ai 已有的配置格式，详细行为和限制请查看对应链接。

## 更新机制

DSH UO 没有自动更新功能。可安装的新版本只通过本仓库的 [GitHub Releases](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases) 发布，需要手动下载并安装。

上游状态入口会分别显示 DSH UO 内置的 Harness 源码提交、GitHub 官方默认分支的变化，以及 npm 上 `@deepseek-ai/dsh` 的 `latest` 版本。GitHub 出现新提交或 npm 出现新版本，只表示上游已有变化；DSH UO 会继续使用固定提交，直到完成检查、适配并发布新的桌面安装包。

## 数据与日志

Windows ZIP 便携版把 Harness 设置、凭据和会话保存在解压目录下的 `data/dsh-home`，默认工作区位于 `data/workspace`。首次启动时，如果这两个便携目录尚不存在，程序会检测 `DSH Desktop Unofficial` 的 Electron 用户数据目录，并复制其中已有的 `dsh-home` 和 `workspace`；AppData 原件会保留，后续启动只使用便携目录。NSIS 安装版继续使用操作系统的 Electron 用户数据目录。

桌面端和 Harness 进程日志写入：

```text
Windows ZIP：<解压目录>/data/logs/dsh-desktop.log
NSIS 安装版：<系统文档目录>/DSH-UO/logs/dsh-desktop.log
```

如果启动失败，错误界面会显示实际日志路径。

## 已知限制

- 目前只发布 Windows x64 和 Linux x64 版本。
- Windows 发行包暂未签名，首次启动可能出现未知发布者或 SmartScreen 提示。
- 应用更新需要从 GitHub Releases 手动下载。
- Linux 默认要求 XWayland，原生 Wayland 仍处于实验阶段。
- Harness 与 DSH UO 都处于预览阶段，后续版本可能包含不兼容变更。
- 上游兼容版本由 [`upstream/harness.json`](upstream/harness.json) 中记录的仓库和完整提交决定。

## 开发文档

普通用户无需执行以下构建步骤。需要修改项目或自行打包时，请从仓库根目录开始，并参考：

- [从源码构建和开发](docs/building.zh.md)
- [维护者发布流程](docs/releasing.zh.md)
- [Harness 覆盖层说明](harness-overrides/README.md)

## 获取支持

桌面打包和 DSH UO 新增功能的问题请提交到[本仓库 Issues](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/issues)。能够在官方 Harness 中复现的问题，请使用上游的 [DeepSeek Harness Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)。

## 许可证

DSH UO 使用 [MIT 许可证](LICENSE)。DeepSeek Harness 与发行包内的第三方组件继续保留各自的版权声明和许可条款。
