# Code Signing and Privacy Policy / 代码签名与隐私政策

[English](#english) | [简体中文](#简体中文)

## English

### Code signing policy

DSH UO intends to use the SignPath Foundation program for eligible future
Windows releases after the project and its artifact configuration have been
accepted. Until a release explicitly identifies signed files and those files
contain a verifiable signature, its Windows artifacts must be treated as
unsigned.

> Free code signing provided by
> [SignPath.io](https://about.signpath.io), certificate by
> [SignPath Foundation](https://signpath.org).

Code signing identifies the publisher and protects the integrity of a specific
artifact after signing. It does not make third-party plugins, model providers,
or generated Agent actions part of the signed DSH UO release.

### Project roles

DSH UO is currently maintained by one person, who holds the following roles:

- Authors and committers: [KaffuAlcaid](https://github.com/KaffuAlcaid)
- Reviewers: [KaffuAlcaid](https://github.com/KaffuAlcaid)
- Signing approvers: [KaffuAlcaid](https://github.com/KaffuAlcaid)

Changes proposed by contributors without direct write access must be reviewed
before they are merged. Every release signing request requires a separate
manual review and approval in SignPath.

### Build and signing process

Tagged releases are built by the checked-in GitHub Actions release workflow on
GitHub-hosted runners. The workflow validates the application version, release
tag, and pinned DeepSeek Harness source commit before building release
artifacts.

The initial requested signing scope is limited to DSH UO-owned release
artifacts approved by SignPath:

- the NSIS installer `DSH-UO-Setup-<version>-x64.exe`;
- the branded desktop executable only if SignPath separately approves it as
  part of this Electron distribution.

Bundled Electron, Node.js, DeepSeek Harness, and other third-party executables
and libraries are not indiscriminately re-signed as DSH UO code. Their original
publisher signatures and license notices are preserved where provided.

After a signing request is approved, the final signature and Windows updater
metadata must be verified before the files are published on GitHub Releases.

### Privacy policy

DSH UO does not operate a maintainer-controlled backend service for application
use and does not add a maintainer-controlled telemetry or analytics service.
The following network communication is part of the current application:

- After the local WebUI starts, packaged Windows distributions automatically
  contact GitHub Releases to check for a DSH UO update. This automatic check
  cannot currently be disabled in the application settings.
- When the user requests an upstream status check, the application contacts
  the GitHub API and the npm registry to compare the bundled DeepSeek Harness
  source and published package version.
- Model requests, prompts, attachments, and related context are sent to the
  model provider or API endpoint selected and configured by the user.
- Installing or updating an npm plugin contacts the configured package
  registry. Installing a local `.tgz` plugin reads the archive selected by the
  user.
- Opening release, documentation, source, or support links opens the selected
  external website in the system browser.
- Agents and user-installed plugins may access additional network services
  when the user configures or authorizes those tools.

As with ordinary HTTPS requests, external services may receive connection
metadata such as the source IP address and user agent. Those services process
data under their own privacy policies. DSH UO maintainers do not receive model
requests, API credentials, sessions, or plugin-registry requests through a DSH
UO-operated service.

Settings, credentials, sessions, workspace data, logs, and user-installed
plugins are stored locally in the distribution-specific data directories
described in the project README. Logs may contain file paths, service URLs, and
error details. Users should review and redact logs before posting them to a
public issue. Data is sent to the maintainers only when a user deliberately
submits it through GitHub or another support channel.

Third-party components, model providers, registries, websites, MCP servers, and
plugins may have separate privacy and security policies. Users should review
those policies before enabling the corresponding service or installing a
plugin.

### Installation and removal

- Windows NSIS installations can be removed from Windows Settings under
  **Apps > Installed apps > DSH UO > Uninstall**.
- Windows and Linux ZIP distributions can be removed by exiting the
  application and deleting the extracted directory. Their portable data is
  stored in the adjacent `data` directory.
- Linux AppImage distributions can be removed by exiting the application and
  deleting the AppImage file.

User data and logs stored outside the application directory may remain after
the application is removed. Review the data and log locations in the README and
delete those directories separately when the data is no longer needed.

### Policy changes and contact

Changes to this policy are recorded in the public Git history. Questions about
DSH UO packaging, signing, or privacy can be reported through
[GitHub Issues](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/issues).
Do not include API keys, credentials, private prompts, or unredacted logs in a
public issue.

## 简体中文

### Code signing policy（代码签名策略）

DSH UO 计划在项目和产物配置通过审核后，为符合条件的后续 Windows
发行版使用 SignPath Foundation 计划。只有具体 Release 明确列出已签名文件，
且文件包含可验证的签名时，才能将其视为已签名；其他 Windows 发行包均应按
未签名文件处理。

> Free code signing provided by
> [SignPath.io](https://about.signpath.io), certificate by
> [SignPath Foundation](https://signpath.org).

代码签名用于标识发布者，并保护具体发行文件在签名后的完整性。第三方插件、
模型服务和 Agent 生成的操作不属于已签名的 DSH UO 发行内容。

### 项目角色

DSH UO 目前由一名维护者负责，角色如下：

- 作者与提交者：[KaffuAlcaid](https://github.com/KaffuAlcaid)
- 审查者：[KaffuAlcaid](https://github.com/KaffuAlcaid)
- 签名批准者：[KaffuAlcaid](https://github.com/KaffuAlcaid)

没有直接写入权限的贡献者所提交的更改必须经过审查后才能合并。每个发行版的
签名请求都需要在 SignPath 中单独进行人工检查和批准。

### 构建与签名流程

带标签的发行版由仓库中的 GitHub Actions 发布工作流在 GitHub 托管的 runner
上构建。工作流会在生成发行文件前检查应用版本、发行标签和固定的 DeepSeek
Harness 源码提交。

首次申请的签名范围仅包括经 SignPath 批准、由 DSH UO 负责的发行文件：

- NSIS 安装器 `DSH-UO-Setup-<version>-x64.exe`；
- 只有在 SignPath 单独批准其属于本 Electron 发行版的情况下，才包括带有
  DSH UO 品牌信息的桌面主程序。

发行包内的 Electron、Node.js、DeepSeek Harness 以及其他第三方可执行文件和
库不会被统一重新签署为 DSH UO 代码。上游提供签名和许可证声明时，发行包会
保留这些信息。

签名请求获批后，必须先检查最终签名和 Windows 更新元数据，再将文件发布到
GitHub Releases。

### 隐私政策

DSH UO 不运营供应用使用的维护者后端服务，也没有增加由维护者控制的遥测或
使用分析服务。当前应用包含以下网络通信：

- 本地 WebUI 启动后，打包的 Windows 发行版会自动访问 GitHub Releases，
  检查 DSH UO 更新。目前无法在应用设置中关闭这项自动检查。
- 用户主动检查上游状态时，应用会访问 GitHub API 和 npm registry，对比内置
  DeepSeek Harness 源码和已发布的 npm 包版本。
- 模型请求、提示词、附件和相关上下文会发送到用户选择并配置的模型服务或
  API 地址。
- 安装或更新 npm 插件时会访问已配置的软件包 registry；安装本地 `.tgz`
  插件时会读取用户选择的压缩包。
- 打开发行版、文档、源码或支持链接时，会通过系统浏览器访问用户选择的外部
  网站。
- Agent 和用户安装的插件可以在用户配置或批准相应工具后访问其他网络服务。

与普通 HTTPS 请求相同，外部服务可能收到来源 IP 地址、User-Agent 等连接
信息，并按照各自的隐私政策处理数据。DSH UO 维护者不会通过 DSH UO 运营的
服务收到模型请求、API 凭据、会话或插件 registry 请求。

设置、凭据、会话、工作区数据、日志和用户安装的插件保存在本地，具体位置见
项目 README。日志可能包含文件路径、服务地址和错误详情；将日志发布到公开
Issue 前，应先检查并删除敏感信息。只有用户主动通过 GitHub 或其他支持渠道
提交数据时，维护者才会收到这些内容。

第三方组件、模型服务、软件包 registry、网站、MCP 服务器和插件可能有独立的
隐私与安全政策。启用对应服务或安装插件前，应查看其政策。

### 安装与移除

- Windows NSIS 安装版可通过 Windows 设置中的“应用 > 已安装的应用 >
  DSH UO > 卸载”移除。
- Windows 和 Linux ZIP 版可在退出应用后删除整个解压目录；便携数据位于旁边
  的 `data` 目录中。
- Linux AppImage 可在退出应用后直接删除 AppImage 文件。

应用目录之外的用户数据和日志可能在卸载后保留。不再需要这些数据时，请根据
README 中的数据与日志位置单独删除相应目录。

### 政策变更与联系

本政策的更改记录在公开的 Git 历史中。与 DSH UO 打包、签名或隐私有关的问题
可以提交到 [GitHub Issues](https://github.com/KaffuAlcaid/dsh-desktop-unofficial/issues)。
请勿在公开 Issue 中提交 API 密钥、凭据、私人提示词或未经处理的日志。
