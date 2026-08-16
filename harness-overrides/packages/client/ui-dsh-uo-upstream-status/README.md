# @dsh-uo/client-ui-upstream-status

English | [中文](README.zh.md)

DSH Desktop Unofficial sidebar action for manually comparing the bundled Harness commit with the official repository's default branch and reading the npm `latest` version of the configured Harness package. The action is visible only when Electron exposes `window.dshDesktop` and the sidebar is expanded. It uses the shared Tooltip, Modal, Button, icon, and theme-token primitives, so the dialog follows the active Harness theme.

The component keeps the latest result in local React state for the current mount. It performs no startup check, writes no status file, and offers no download, application update, or source replacement action. GitHub and npm registry access and response validation belong to the Electron main process; the browser receives one JSON-compatible result through the sandboxed preload API.

## Model Experience

None; repository status is desktop UI data and never reaches a model request.

### KV Cache effect

None; this package neither assembles nor sends provider requests.

## Known Limitations and Deferred Work

- Official source movement and the npm publication are independent signals. A newer npm version does not establish that the pinned GitHub source has moved or that a compatible DSH UO package exists.
- The action does not query DSH UO Releases, download packages, or update the desktop application.
- Collapsed sidebars hide the action because the 56px rail reserves its bottom position for Settings.
