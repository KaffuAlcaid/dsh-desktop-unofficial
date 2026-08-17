# Harness overrides

此目录是 DSH-UO 对 DeepSeek Harness WebUI 的源码改造来源。官方仓库保持干净；`scripts/prepare-harness.ps1` 从 `upstream/harness.json` 指定的官方提交创建独立 Git worktree，再复制此处的 DSH-UO 插件并应用统一补丁。

当前覆盖内容包括：

- `packages/client/ui-dsh-uo-upstream-status`：仅在 Electron preload API 存在且侧栏展开时显示的上游状态入口。
- `packages/client/ui-dsh-uo-reasoning-effort`：占用 Models 页单模型 slot 的独立 Cordis 客户端插件，负责思考强度折叠、预设、自定义映射和系统提示词角色编辑。
- `packages/client/ui-dsh-uo-model-input`：占用 Models 页独立单模型 slot 的输入能力插件，提供跟随思考映射预设的自动模式，以及仅文本、文本与图片两种手动模式。
- `packages/client/ui-dsh-uo-system-prompt`：在 Agent 预设页创建用户预设并编辑 persona 系统提示词。创建入口位于官方创造模式入口上方，编辑入口位于每个用户预设卡片中。
- `patches/0001-dsh-uo-upstream-status.patch`：侧栏横向页脚布局、插件注册、TypeScript aggregate 与 pnpm 锁文件改动。
- `patches/0002-dsh-uo-reasoning-effort.patch`：为官方 Models 页加入单模型思考 slot、基础参数折叠、通用映射校验以及 Web bundle 默认插件组合。官方组件只传递模型草稿和展开回调；思考界面与映射逻辑由独立插件提供。自定义提供方展开模型时默认显示思考设置，但不自动写入映射。Gemini 不在预设中。
- `patches/0003-dsh-uo-model-input.patch`：在基础参数与思考强度之间加入独立输入能力 slot，并将插件登记到 Web bundle、TypeScript aggregate 与 pnpm 锁文件。
- `patches/0004-pi-ai-developer-role.patch`：开放 pi-ai 已支持的 `compat.supportsDeveloperRole`，允许 `openai-completions` 与 `openai-responses` 模型覆盖系统提示词使用的 `developer` 或 `system` 角色。
- `patches/0005-agent-preset-persona-api.patch`：为用户 Agent 预设增加 persona 读取与写入 API。写入只替换 `@deepseek-ai/dsh-persona` 的 `config.text`，并保留 YAML 的其他内容与换行格式。
- `patches/0006-dsh-uo-system-prompt-editor.patch`：为 Agent 预设界面加入可选创建、卡片操作 slot，并注册系统提示词插件。

输入能力插件只写 Harness 已有的模型 `input` 字段。自动模式从同一模型已经保存的思考映射反推用户选择的预设：OpenAI GPT、Anthropic Claude、xAI Grok、Kimi 写入 `[text, image]`，GLM、DeepSeek 写入 `[text]`；切换预设时会继续同步，手动选择输入模式后停止跟随。自定义映射或没有选择预设时，自动模式删除显式声明，由 Harness 依次使用内置模型目录、提供方 `defaultInput`，最后回落到 `[text]`。插件不会探测上游接口，也不会按模型 ID 猜测。遇到插件尚不认识的未来模态时，界面保留原配置，直到用户主动选择其他模式。

思考插件在两种 OpenAI 协议下提供三态系统提示词角色设置：自动判断会删除 `compat.supportsDeveloperRole`，由 pi-ai 使用协议默认行为；Developer 写入 `true`；System 写入 `false`。该功能不探测第三方端点，也不修改 pi-ai 依赖。

思考插件不写入 DSH-UO 专属设置字段。上游提供等价功能时，可先从 `cordis.patch.yml` 移除插件条目停止构建注入，再分别删除 bundle 依赖、TypeScript 引用和插件目录；Models 页在 slot 无占用者时仍可使用。最后对照上游实现决定是否保留通用校验与折叠补丁。

`0004` 只补充 Harness 对 pi-ai 现有字段的配置校验与透传。上游开放同一字段后可直接移除该补丁；若上游同时提供角色编辑界面，再从思考插件中删除对应下拉框，其他思考映射功能不受影响。

输入能力插件也可独立退场。移除 `dsh-uo-model-input` 的 Cordis 条目、bundle 依赖、TypeScript 引用和覆盖源码后，Harness 仍会识别已经保存的 `input`；若官方提供等价编辑器，再对照其 slot 或内置界面决定是否删除 `0003` 的 Models 页接入改动。

系统提示词插件同样可独立退场。移除 `dsh-uo-system-prompt` 的 Cordis 条目、bundle 依赖、TypeScript 引用和覆盖源码后，界面入口消失；用户预设仍是原生 `agent.cordis.yml`，已经保存的 persona 文本会继续由 Harness 使用。若官方提供等价界面，可同时移除 `0005` 与 `0006`。

准备源码（打包脚本在缺少 prepared Harness 时也会自动执行此步骤）：

```powershell
corepack pnpm run prepare:harness
```

```bash
corepack pnpm run prepare:harness:linux
```

默认从 `upstream/harness.json` 指定的仓库和提交自动拉取源码，缓存于 `.build/deepseek-harness-upstream`；Windows 输出为 `.build/deepseek-harness`，Linux 输出为 `.build/deepseek-harness-linux`。仍可向准备脚本显式传入已有上游 Git 工作树。已有输出目录会让脚本停止；先通过错误信息给出的 `git worktree remove` 命令移除旧 worktree，再重新准备。

源码、包管理器和打包工具缓存均保存在项目的 `.build` 目录，该目录已由根 `.gitignore` 忽略。
