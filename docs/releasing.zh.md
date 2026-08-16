# 发布 DSH UO

[English](releasing.md) | 简体中文

本页供项目维护者使用。与应用版本一致的标签会触发[发布工作流](../.github/workflows/release.yml)，构建并发布当前支持的四个产物。

## 1. 准备发布提交

1. 更新 [`package.json`](../package.json) 中的 `version`。
2. 确认 [`upstream/harness.json`](../upstream/harness.json) 包含计划使用的官方仓库、npm 包名、完整源码提交、源码版本、包管理器和 Node.js 范围。
3. 确认 [`harness-overrides/patches`](../harness-overrides/patches) 中的每个补丁都能应用到固定提交，并且注入包文档与当前行为一致。
4. 对照 [`electron-builder.yml`](../electron-builder.yml) 和发布工作流，检查 README 中的产物名、支持平台和限制。
5. 发布提交中不要包含 `.build`、`resources/runtime` 或 `release` 下的生成内容。

npm `latest` 版本只作为上游发布信息。不要为了匹配 npm 版本字符串直接改变源码固定提交；应先检查和适配对应的官方源码。

## 2. 在 `main` 上验证

把发布提交推送到 `main`，等待 [CI](../.github/workflows/ci.yml) 通过。CI 工作流会：

- 构建 Windows x64 ZIP 和 NSIS 安装器；
- 检查 Windows 打包运行时和内置 DSH 命令；
- 构建 Linux x64 ZIP 和 AppImage；
- 在 Xvfb 中启动打包后的 Linux 桌面端并等待 WebUI；
- 检查压缩包内容和内置 Harness 清单。

Windows 或 Linux 任务仍然失败时，不要从该提交创建发布标签。

## 3. 创建标签

标签必须是字母 `v` 加 `package.json` 中的完整版本：

```bash
version="$(node -p "require('./package.json').version")"
git tag -a "v$version" -m "DSH UO v$version"
git push origin "v$version"
```

标签与版本不一致，或者 Harness 清单缺少完整 Git 提交或 npm 包名时，工作流会拒绝发布。

## 4. 检查 GitHub Release

完成后的工作流必须发布以下四个文件：

| 平台 | 预期产物 |
| --- | --- |
| Windows x64 | `DSH-UO-<version>-win-x64.zip` |
| Windows x64 | `DSH-UO-Setup-<version>-x64.exe` |
| Linux x64 | `DSH-UO-<version>-linux-x64.zip` |
| Linux x64 | `DSH-UO-<version>-linux-x86_64.AppImage` |

确认 Release 标题与标签使用同一版本。在 Release Notes 中补充内置 Harness 的准确源码版本与完整提交，以及面向用户的变更和已知限制。通用 README 刻意不写死这些发行专属值。

当前工作流不生成代码签名或校验和文件，因此不要把产物描述为已签名或已提供校验和。

## 5. 测试已发布下载

应使用从 GitHub Release 下载的文件，不使用本地 `release/` 输出代替：

1. 安装 Windows 安装包并通过快捷方式启动。
2. 把 Windows ZIP 解压到独立目录并运行其中的程序。
3. 为 Linux AppImage 添加执行权限，并通过受支持的 XWayland 路径启动。
4. 解压 Linux ZIP 并运行 `dsh-uo`。
5. 在可用平台上确认 WebUI 能够加载，可以配置模型和选择工作区；工作流提供命令入口时，还要确认内置 Harness 能报告版本。
6. 打开上游状态入口，确认 GitHub 源码状态、npm 发布版本与 DSH UO 更新分别显示。

已经公开的 Release 如果需要修正版，请在 `main` 上完成修复，选择新的应用版本并发布新标签。不要把已经公开的标签移动到另一个提交。
