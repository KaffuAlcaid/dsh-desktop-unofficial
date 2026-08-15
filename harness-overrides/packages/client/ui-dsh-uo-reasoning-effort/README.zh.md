# @dsh-uo/client-ui-reasoning-effort

[English](README.md) | 中文

DSH Desktop Unofficial 的单模型思考强度客户端插件。插件占用官方 Models 插件声明的单实例 `settings.models.model.reasoning` slot，只写入 Harness 与 pi-ai 已有的 `reasoningEfforts`、`compat.thinkingFormat`、`compat.supportsReasoningEffort` 和 `compat.supportsDeveloperRole` 字段。

插件提供 OpenAI GPT、Anthropic Claude、xAI Grok、Kimi、GLM、DeepSeek 手动预设以及自定义映射。插件不会根据模型 ID 猜测预设，Gemini 没有预设或专用适配。

对于 `openai-completions` 和 `openai-responses`，系统提示词角色可以保持 pi-ai 的协议默认行为，也可以显式固定为 `Developer` 或 `System`。该设置只覆盖 pi-ai 的角色选择，不探测端点。

Web bundle 默认启用此插件。禁用或移除其 Cordis 条目后，思考设置界面会消失，官方 Models 编辑器及其已保存数据校验仍然保留。

## 退场方式

如果 Harness 日后提供等价功能，先从 Web bundle 补丁中移除 `dsh-uo-reasoning-effort` Cordis 条目，即可停止注入插件；没有 slot 占用者时，官方 Models 页面仍可正常工作。之后可以分别移除 package 依赖、TypeScript 项目引用和覆盖插件目录。最后对照上游实现，再决定是否删除 Models 页的小型 slot 与校验补丁。

用户设置无需迁移：插件只写入 Harness 与 pi-ai 已支持的字段，不写入 DSH-UO 标记或预设 ID。
