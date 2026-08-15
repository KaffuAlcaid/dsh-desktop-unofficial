# @dsh-uo/client-ui-model-input

[English](README.md) | 中文

DSH Desktop Unofficial 的单模型输入能力客户端插件。插件占用 Models 页面声明的单实例 `settings.models.model.input` slot，只写入 Harness 已有的模型 `input` 字段。

三个模式分别是自动、仅文本（`[text]`）和文本与图片（`[text, image]`）。自动模式跟随同一模型已经选择的思考映射预设：OpenAI GPT、Anthropic Claude、xAI Grok、Kimi 使用文本与图片，GLM、DeepSeek 使用仅文本。切换预设时，仍处于自动模式的输入能力会同步更新；用户主动选择另一个输入模式后停止跟随。

自定义思考映射或没有选择预设时，自动模式删除 `input`，继续使用 Harness 的内置模型目录、提供方 `defaultInput` 和最终仅文本回退。插件不会根据提供商或模型 ID 猜测能力，也不会探测上游接口。遇到未来版本新增的未知模态时，插件会保留原配置，直到用户主动选择其他模式。

Web bundle 默认启用此插件。禁用或移除其 Cordis 条目后，输入能力界面会消失，Harness 仍会继续识别已经保存的 `input`。

## 退场方式

如果 Harness 日后提供等价功能，先从 Web bundle 补丁中移除 `dsh-uo-model-input` Cordis 条目；没有 slot 占用者时，官方 Models 页面仍可正常工作。之后可以分别移除 package 依赖、TypeScript 项目引用和覆盖插件目录。最后对照上游实现，再决定是否删除 Models 页的小型 slot 补丁。

用户设置无需迁移，因为插件只写入 Harness 已有的 `input` 字段。
