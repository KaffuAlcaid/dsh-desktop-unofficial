# DeepSeek Harness 社区资料清单

_调查日期：2026-08-15。用于 DSH-UO 开发取舍，不代表项目背书或安全审计。_

官方仓库当前未开放 Issues，因此本清单以 [DeepSeek Harness Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)、讨论中引用的源码仓库和 npm registry 为主要来源。现阶段只做发现与人工核对，不自动安装社区插件，也不加入插件市场。

## 结论摘要

| 方向 | 当前结论 | 处理方式 |
| --- | --- | --- |
| 上游更新 | 社区更新器面向 npm 全局安装，与本项目固定官方源码提交的更新模型不同 | 只参考交互和状态设计，不直接依赖 |
| 思考强度 | 社区已有相近插件，但提交少、运行时侵入更大；第三方网关还存在协议方言问题 | 保留 DSH-UO 的构建时插件；继续跟踪上游兼容字段 |
| 图片输入 | `input` 声明只能描述上游真实能力，不能给纯文本模型增加视觉 | 保留当前能力编辑器；sidecar 视觉另立功能，不混入能力声明 |
| Electron 桌面壳 | 已有同类项目实现服务生命周期、托盘和安装包 | 作为实现参考，不合并其整套 Harness 源码和补丁 |
| 插件生态 | 社区目录规模大，但多数条目没有完成审计 | 只做人工筛选；安装前固定 owner、仓库和 commit |

## 优先对照

### 上游更新

- [Discussion #1812：dsh-check-update](https://github.com/deepseek-ai/deepseek-harness/discussions/1812)
- [源码仓库](https://github.com/HuiHuitie-zhu/dsh-check-update)
- [npm 包](https://www.npmjs.com/package/dsh-check-update)

2026-08-15 查询到 npm 版本为 `0.3.0`，许可证字段为 MIT。功能包括 DSH 与插件版本检查、导航提示、一键更新、Release Notes、备份和回滚。该插件针对 `npm install -g @deepseek-ai/dsh`，本项目则跟踪 `upstream/harness.json` 固定的官方 Git 提交，两者的版本来源和更新落点不同。可参考弹窗、更新说明和失败状态，不采用其更新执行逻辑。

同日 npm registry 的 `@deepseek-ai/dsh`：`latest` 与 `next` 都是 `0.1.0-rc.6`。本项目固定基线仍以 `upstream/harness.json` 为准，不能用 npm dist-tag 直接替换 Git 提交。

### 思考强度

- [Discussion #1817：dsh-thinking-effort](https://github.com/deepseek-ai/deepseek-harness/discussions/1817)
- [源码仓库](https://github.com/hytime/dsh-thinking-effort)
- [Discussion #302：自定义 provider 配置方式](https://github.com/deepseek-ai/deepseek-harness/discussions/302)
- [Discussion #843：GUI 缺少第三方模型思考档位](https://github.com/deepseek-ai/deepseek-harness/discussions/843)

`dsh-thinking-effort` 同时包含宿主和浏览器插件，给缺少声明的模型补齐默认档位，并新增独立设置页。仓库有 MIT LICENSE，调查时只有 3 个提交、无 Release。它运行时修改设置，并写入加载标记；DSH-UO 已采用构建时注入、原 Models 行内多级折叠和可整块移除的小补丁，因此只把它作为实现对照。

需要单独跟踪协议兼容问题：

- [Discussion #1643：DeepSeek 风格网关拒绝 developer 角色](https://github.com/deepseek-ai/deepseek-harness/discussions/1643)
- [Discussion #559：第三方网关自动探测与方言预设](https://github.com/deepseek-ai/deepseek-harness/discussions/559)
- [Discussion #564：思考档位和方言自动修复](https://github.com/deepseek-ai/deepseek-harness/discussions/564)

仅写入 `reasoningEfforts`、`thinkingFormat` 和 `supportsReasoningEffort`，仍可能在不接受 `developer` 角色的网关上得到 400。社区提议增加 `supportsDeveloperRole` 并探测更多协议差异。自动探测会向用户网关发送试探请求，具有真实网络副作用，现阶段不引入；后续若扩展兼容字段，应先确定 UI、保存格式和验证方式。

### 图片输入与视觉代理

- [Discussion #427：纯文本模型的图片准入问题](https://github.com/deepseek-ai/deepseek-harness/discussions/427)
- [Discussion #474：DeepSeek V4 图片输入与视觉代理](https://github.com/deepseek-ai/deepseek-harness/discussions/474)
- [Discussion #1709：dsh-plugin-multimodal](https://github.com/deepseek-ai/deepseek-harness/discussions/1709)
- [dsh-plugin-multimodal 源码](https://github.com/shinjiyu/dsh-plugin-multimodal)

当前 `dsh-uo-model-input` 只声明模型输入能力。给纯文本模型写入 `input: [text, image]` 只能通过 Harness 本地门禁，图片仍会被纯文本 adapter 或上游拒绝。社区方案主要分为三类：修改核心后把附件路径交给视觉 skill、创建视觉伴生路由、用 sidecar 视觉模型先转成文字。它们属于新的多模态路由功能，不应塞进输入能力编辑器。

### 桌面壳

- [anywhere-labs/deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop)

该项目提供 Windows/macOS 桌面壳、Harness 服务生命周期、托盘和安装包，仓库有 MIT LICENSE 与第三方声明。它同时携带大量官方源码和自身补丁，直接合并会扩大上游同步冲突；适合核对进程退出、托盘和打包行为。

## 开发工具候选

- [Discussion #1814：dsh-plugin-doctor](https://github.com/deepseek-ai/deepseek-harness/discussions/1814)
- [zoahdev/dsh-plugin-doctor](https://github.com/zoahdev/dsh-plugin-doctor)

该工具检查 manifest、Cordis patch、构建、打包、全新 profile 安装、宿主依赖遮蔽，以及 Node、pnpm、PATH 和端口。源码仓库有 MIT LICENSE，调查时约 58 个提交，适合以后作为开发检查工具，不适合作为发行版默认插件。

npm 存在名称碰撞：2026-08-15 查询到 `dsh-plugin-doctor@0.1.0` 指向 [Xrainsmile/DSH-Plugin-Doctor](https://github.com/Xrainsmile/DSH-Plugin-Doctor)，而 zoahdev 仓库的源码使用同名包和不同版本。不得推荐裸执行 `npx dsh-plugin-doctor`；若采用，应固定仓库 owner 和 commit。

## 目录来源

- [Discussion #1798：生态周报](https://github.com/deepseek-ai/deepseek-harness/discussions/1798)
- [zoahdev/dsh-ecosystem](https://github.com/zoahdev/dsh-ecosystem)
- [精选插件目录](https://github.com/zoahdev/dsh-ecosystem/blob/main/docs/plugins.md)
- [Discussion #1828：dsh-subscribe](https://github.com/deepseek-ai/deepseek-harness/discussions/1828)
- [zoahdev/dsh-subscribe](https://github.com/zoahdev/dsh-subscribe)

生态目录约有 40 个精选条目，大部分标为未审计。`dsh-subscribe` 的帖子称收录 536 个插件，并有一个较小的验证层。这里的 verified 或 audited 是社区项目自己的检查口径，不能等同于 DSH-UO 的安全审核或兼容性保证。

## 已知上游问题

| 问题 | 资料 | 与 DSH-UO 的关系 |
| --- | --- | --- |
| Windows 原生文件夹选择器失败 | [Discussion #30](https://github.com/deepseek-ai/deepseek-harness/discussions/30) | 可能涉及 koffi 安装、残留进程和 Node/Electron 组合；当前桌面 MVP 已实际通过选择与取消验收，先记录再复现 |
| Windows 中文路径被截断 | [Discussion #1777](https://github.com/deepseek-ai/deepseek-harness/discussions/1777) | 发布前需要加入中文路径验收，不能只验证 ASCII 目录 |
| profile JSON 带 UTF-8 BOM 时启动崩溃 | [Discussion #1842](https://github.com/deepseek-ai/deepseek-harness/discussions/1842) | 未来导入 `.dsh` 或设置文件时，应在解析前识别并去掉 BOM |
| Web 多轮丢失 reasoning blocks | [Discussion #231](https://github.com/deepseek-ai/deepseek-harness/discussions/231) | 使用 `openai-responses` 的第三方网关可能在后续轮次返回 400 |
| DeepSeek 工具轮缺少 `reasoning_content` | [Discussion #739](https://github.com/deepseek-ai/deepseek-harness/discussions/739) | 开启思考档位后，工具调用链需要单独验收 |
| 跨 provider 历史回放丢失思考内容 | [Discussion #1146](https://github.com/deepseek-ai/deepseek-harness/discussions/1146)、[Discussion #1780](https://github.com/deepseek-ai/deepseek-harness/discussions/1780) | 会话中途切换官方与第三方 provider 是高风险路径 |
| 请求重建检查遗漏 provider 和 reasoning effort | [Discussion #375](https://github.com/deepseek-ai/deepseek-harness/discussions/375) | 固定基线正是该讨论复现的提交；更新基线时应核对上游是否修复 |

## 引入前检查

采用任何社区插件或补丁前，至少核对：

1. 包名、GitHub owner、仓库地址是否一致，npm 是否存在同名包。
2. 仓库是否包含实际 LICENSE 文件，不能只依据 README 或 `package.json` 字段。
3. 固定 tag 或 commit，记录适用的 Harness 版本和 Node/pnpm 要求。
4. Cordis 插件 ID、slot、host/client 半区是否与 DSH-UO 现有插件冲突。
5. 安装、postinstall、构建和运行时会写哪些目录，是否执行外部命令或网络请求。
6. 在全新 profile 中验证安装、启动、实际调用和卸载；“可以加载”不能代替功能验证。
7. 若只借鉴设计，重新实现必要部分并保留来源链接，避免把整套社区补丁并入固定上游基线。
