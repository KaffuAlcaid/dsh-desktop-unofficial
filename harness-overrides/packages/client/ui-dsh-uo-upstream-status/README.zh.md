# @dsh-uo/client-ui-upstream-status

[English](README.md) | 中文

DSH Desktop Unofficial 的侧边栏操作，用于手动比较内置 Harness 提交与官方仓库默认分支，并读取配置中 Harness npm 包的 `latest` 版本。仅当 Electron 暴露 `window.dshDesktop` 且侧边栏处于展开状态时显示。按钮和弹窗复用 Harness 的 Tooltip、Modal、Button、图标与主题 token，随当前主题显示。

组件只在当前挂载期间使用 React 本地状态保留最近一次结果。它不会在启动时检查，不会写入状态文件，也不提供下载、应用更新或替换源码操作。GitHub 和 npm registry 的网络访问与响应校验由 Electron 主进程负责；浏览器只通过沙箱 preload API 接收一次 JSON 兼容结果。

## 模型体验

无。仓库状态只用于桌面界面，不会进入模型请求。

### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- 官方源码变化和 npm 发布是两项独立信息。npm 出现新版本，不能说明固定的 GitHub 源码已经变化，也不能说明已有兼容的 DSH UO 发行包。
- 此入口不查询 DSH UO Releases，不下载发行包，也不更新桌面应用。
- 侧边栏折叠时隐藏此入口，因为 56px 轨道底部位置保留给设置。
