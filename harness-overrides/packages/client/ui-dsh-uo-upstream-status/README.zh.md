# @dsh-uo/client-ui-upstream-status

[English](README.md) | 中文

DSH Desktop Unofficial 的侧边栏操作，用于手动比较内置 Harness 提交与官方仓库默认分支。仅当 Electron 暴露 `window.dshDesktop` 且侧边栏处于展开状态时显示。按钮和弹窗复用 Harness 的 Tooltip、Modal、Button、图标与主题 token，随当前主题显示。

组件只在当前挂载期间使用 React 本地状态保留最近一次结果。它不会在启动时检查，不会写入状态文件，也不提供下载或替换源码操作。网络访问和 GitHub 响应校验由 Electron 主进程负责；浏览器只通过沙箱 preload API 接收一次 JSON 兼容结果。

## 模型体验

无。仓库状态只用于桌面界面，不会进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- 此入口报告官方 Harness 源码变化，不报告 DSH-UO 是否发布了新安装包。
- 侧边栏折叠时隐藏此入口，因为 56px 轨道底部位置保留给设置。
