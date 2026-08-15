# Harness overrides

此目录是 DSH-UO 对 DeepSeek Harness WebUI 的源码改造来源。官方仓库保持干净；`scripts/prepare-harness.ps1` 从 `upstream/harness.json` 指定的官方提交创建独立 Git worktree，再复制此处的 DSH-UO 插件并应用统一补丁。

当前覆盖内容包括：

- `packages/client/ui-dsh-uo-upstream-status`：仅在 Electron preload API 存在且侧栏展开时显示的上游状态入口。
- `packages/client/ui-dsh-uo-reasoning-effort`：占用 Models 页单模型 slot 的独立 Cordis 客户端插件，负责思考强度折叠、预设、自定义映射和兼容字段编辑。
- `patches/0001-dsh-uo-upstream-status.patch`：侧栏横向页脚布局、插件注册、TypeScript aggregate 与 pnpm 锁文件改动。
- `patches/0002-dsh-uo-reasoning-effort.patch`：为官方 Models 页加入单模型思考 slot、基础参数折叠、通用映射校验以及 Web bundle 默认插件组合。官方组件只传递模型草稿和展开回调；思考界面与映射逻辑由独立插件提供。自定义提供方展开模型时默认显示思考设置，但不自动写入映射。Gemini 不在预设中。

思考插件不写入 DSH-UO 专属设置字段。上游提供等价功能时，可先从 `cordis.patch.yml` 移除插件条目停止构建注入，再分别删除 bundle 依赖、TypeScript 引用和插件目录；Models 页在 slot 无占用者时仍可使用。最后对照上游实现决定是否保留通用校验与折叠补丁。

准备源码：

```powershell
corepack pnpm run prepare:harness
```

默认输入为相邻目录 `..\deepseek-harness`，输出为 `.build\deepseek-harness`。已有输出目录会让脚本停止；先通过错误信息给出的 `git worktree remove` 命令移除旧 worktree，再重新准备。
