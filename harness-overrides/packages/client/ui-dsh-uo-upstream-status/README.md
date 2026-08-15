# @dsh-uo/client-ui-upstream-status

English | [中文](README.zh.md)

DSH Desktop Unofficial sidebar action for manually comparing the bundled Harness commit with the official repository's default branch. The action is visible only when Electron exposes `window.dshDesktop` and the sidebar is expanded. It uses the shared Tooltip, Modal, Button, icon, and theme-token primitives, so the dialog follows the active Harness theme.

The component keeps the latest result in local React state for the current mount. It performs no startup check, writes no status file, and offers no download or source replacement action. Network access and GitHub response validation belong to the Electron main process; the browser receives one JSON-compatible result through the sandboxed preload API.

## Model Experience

None; repository status is desktop UI data and never reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends provider requests.

## Known Limitations and Deferred Work

- The action reports official Harness source movement; it does not report whether a newer DSH-UO installer exists.
- Collapsed sidebars hide the action because the 56px rail reserves its bottom position for Settings.
