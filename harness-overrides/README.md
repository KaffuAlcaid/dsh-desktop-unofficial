# Harness overrides

此目录是 DSH-UO 对 DeepSeek Harness WebUI 的源码改造来源。官方仓库保持干净；`scripts/prepare-harness.ps1` 从 `upstream/harness.json` 指定的官方提交创建独立 Git worktree，再复制此处的 DSH-UO 插件并应用统一补丁。

当前覆盖内容包括：

- `packages/client/ui-dsh-uo-upstream-status`：仅在 Electron preload API 存在且侧栏展开时显示的上游状态入口。
- `patches/0001-dsh-uo-upstream-status.patch`：侧栏横向页脚布局、插件注册、TypeScript aggregate 与 pnpm 锁文件改动。

准备源码：

```powershell
corepack pnpm run prepare:harness
```

默认输入为相邻目录 `..\deepseek-harness`，输出为 `.build\deepseek-harness`。已有输出目录会让脚本停止；先通过错误信息给出的 `git worktree remove` 命令移除旧 worktree，再重新准备。
