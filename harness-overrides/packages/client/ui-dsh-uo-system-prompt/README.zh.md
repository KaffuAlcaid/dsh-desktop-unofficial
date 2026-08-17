# DSH-UO 系统提示词编辑器

浏览器插件：从 `standard` 创建用户 Agent 预设，并且只编辑 `@deepseek-ai/dsh-persona` 的 `config.text`。YAML 校验与原子写入由宿主补丁负责。

保存结果只影响后续新建的会话，已有会话继续使用启动时挂载的预设版本。

## 模型体验

- 模型输入：无。
- 模型可见提示词：后续会话由 Harness 现有 persona 插件挂载已保存文本。
- Token 与 KV cache 影响：取决于保存的文本；编辑器本身不增加内容。

## 已知限制与后续工作

- 宿主必须包含匹配的 Agent 预设 persona API 与 UI 插槽补丁。
