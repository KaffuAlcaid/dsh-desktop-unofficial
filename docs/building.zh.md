# 从源码构建 DSH UO

[English](building.md) | 简体中文

本页面向贡献者和维护者。使用预构建发行包的普通用户不需要安装 Node.js、pnpm，也不需要准备 Harness 源码。

## 前置条件

- Git
- 符合 [`package.json`](../package.json) 中 `engines` 要求的 Node.js
- Corepack，以及 `packageManager` 声明的 pnpm 版本
- 能够下载固定 Harness 源码、npm 依赖、Electron 和打包用 Node.js 运行时的网络
- 构建 Windows 包需要 Windows x64；构建 Linux 包需要 Linux x86_64

[`upstream/harness.json`](../upstream/harness.json) 固定了上游仓库、源码提交、包管理器和兼容的 Node.js 范围。构建时不要用 npm 的 `latest` 包替代固定的源码工作树。

## Windows 开发运行

安装桌面端依赖并准备固定的 Harness 工作树：

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run prepare:harness

Push-Location .build\deepseek-harness
corepack pnpm install --frozen-lockfile
Pop-Location
```

构建 Harness 和 Electron 主程序，然后启动桌面应用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\dev.ps1
```

`dev.ps1` 要求 Harness 工作树及其依赖已经准备完成。它会重新构建 Harness，再启动 Electron。

## Linux 开发运行

安装依赖并准备 Linux Harness 工作树：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run prepare:harness:linux

cd .build/deepseek-harness-linux
corepack pnpm install --frozen-lockfile
corepack pnpm run build
cd ../..
```

让 Electron 使用该工作树并启动：

```bash
DSH_DESKTOP_HARNESS_DIR=.build/deepseek-harness-linux corepack pnpm run dev
```

## 构建发行包

在 Windows x64 上构建 Windows ZIP 和 NSIS 安装器：

```powershell
corepack pnpm install --frozen-lockfile
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-portable.ps1 -Target all
```

在 Linux x86_64 上构建 Linux ZIP 和 AppImage：

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm run package:portable:linux
```

两个打包脚本都会在需要时准备固定的 Harness 源码并安装缺失依赖。脚本会构建 Harness，在 `resources/runtime` 中生成独立运行时，加入 Node.js，并把产物写入 `release/`。

源码工作树、缓存、暂存运行时和发行产物均由 Git 忽略。准备脚本不会覆盖现有 Harness 工作树；上游固定提交变化后，请按照脚本错误信息给出的命令移除旧工作树，再重新准备。

## 仓库结构

- [`src/`](../src)：Electron 主进程、preload 接口、Harness 进程管理、日志与上游检查。
- [`harness-overrides/`](../harness-overrides)：注入固定官方源码的 DSH UO 插件和补丁。
- [`scripts/`](../scripts)：源码准备、独立运行时暂存和跨平台打包脚本。
- [`upstream/harness.json`](../upstream/harness.json)：上游源码固定信息和工具链元数据。
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)：Windows 与 Linux 打包运行时验证。

修改补丁或注入包之前，请先阅读 [Harness 覆盖层说明](../harness-overrides/README.md)。
