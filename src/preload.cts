import electron = require('electron')
import type {
  DshDesktopApi, HarnessUpstreamCheckResult,
} from './desktop-api.js' with { "resolution-mode": "import" }

const { contextBridge, ipcRenderer } = electron

const CHECK_HARNESS_UPSTREAM_CHANNEL = 'dsh-desktop:check-harness-upstream'

const api: DshDesktopApi = Object.freeze({
  checkHarnessUpstream: async (): Promise<HarnessUpstreamCheckResult> =>
    await ipcRenderer.invoke(CHECK_HARNESS_UPSTREAM_CHANNEL) as HarnessUpstreamCheckResult,
})

contextBridge.exposeInMainWorld('dshDesktop', api)
