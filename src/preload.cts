import electron = require('electron')
import type {
  AppUpdateOperationResult, AppUpdateState, DshDesktopApi, HarnessRestartResult,
  HarnessUpstreamCheckResult,
} from './desktop-api.js' with { "resolution-mode": "import" }
import type {
  PluginListResult, PluginMutationResult, PluginTarget,
} from './plugin-manager.js' with { "resolution-mode": "import" }

const { contextBridge, ipcRenderer } = electron

const CHECK_HARNESS_UPSTREAM_CHANNEL = 'dsh-desktop:check-harness-upstream'
const GET_APP_UPDATE_STATE_CHANNEL = 'dsh-desktop:get-app-update-state'
const CHECK_APP_UPDATE_CHANNEL = 'dsh-desktop:check-app-update'
const DOWNLOAD_APP_UPDATE_CHANNEL = 'dsh-desktop:download-app-update'
const INSTALL_APP_UPDATE_CHANNEL = 'dsh-desktop:install-app-update'
const OPEN_APP_UPDATE_PAGE_CHANNEL = 'dsh-desktop:open-app-update-page'
const APP_UPDATE_STATE_CHANNEL = 'dsh-desktop:app-update-state'
const LIST_PLUGINS_CHANNEL = 'dsh-desktop:list-plugins'
const INSTALL_PLUGIN_CHANNEL = 'dsh-desktop:install-plugin'
const UPDATE_PLUGIN_CHANNEL = 'dsh-desktop:update-plugin'
const REMOVE_PLUGIN_CHANNEL = 'dsh-desktop:remove-plugin'
const PICK_PLUGIN_ARCHIVE_CHANNEL = 'dsh-desktop:pick-plugin-archive'
const RESTART_HARNESS_CHANNEL = 'dsh-desktop:restart-harness'

const api: DshDesktopApi = Object.freeze({
  checkHarnessUpstream: async (): Promise<HarnessUpstreamCheckResult> =>
    await ipcRenderer.invoke(CHECK_HARNESS_UPSTREAM_CHANNEL) as HarnessUpstreamCheckResult,
  getAppUpdateState: async (): Promise<AppUpdateState> =>
    await ipcRenderer.invoke(GET_APP_UPDATE_STATE_CHANNEL) as AppUpdateState,
  checkAppUpdate: async (): Promise<AppUpdateOperationResult> =>
    await ipcRenderer.invoke(CHECK_APP_UPDATE_CHANNEL) as AppUpdateOperationResult,
  downloadAppUpdate: async (): Promise<AppUpdateOperationResult> =>
    await ipcRenderer.invoke(DOWNLOAD_APP_UPDATE_CHANNEL) as AppUpdateOperationResult,
  installAppUpdate: async (): Promise<AppUpdateOperationResult> =>
    await ipcRenderer.invoke(INSTALL_APP_UPDATE_CHANNEL) as AppUpdateOperationResult,
  openAppUpdatePage: async (): Promise<AppUpdateOperationResult> =>
    await ipcRenderer.invoke(OPEN_APP_UPDATE_PAGE_CHANNEL) as AppUpdateOperationResult,
  onAppUpdateState: (listener: (state: AppUpdateState) => void): (() => void) => {
    const subscription = (_event: electron.IpcRendererEvent, state: AppUpdateState): void => {
      listener(state)
    }
    ipcRenderer.on(APP_UPDATE_STATE_CHANNEL, subscription)
    return () => { ipcRenderer.removeListener(APP_UPDATE_STATE_CHANNEL, subscription) }
  },
  listPlugins: async (): Promise<PluginListResult> =>
    await ipcRenderer.invoke(LIST_PLUGINS_CHANNEL) as PluginListResult,
  installPlugin: async (target: PluginTarget): Promise<PluginMutationResult> =>
    await ipcRenderer.invoke(INSTALL_PLUGIN_CHANNEL, target) as PluginMutationResult,
  updatePlugin: async (target: PluginTarget): Promise<PluginMutationResult> =>
    await ipcRenderer.invoke(UPDATE_PLUGIN_CHANNEL, target) as PluginMutationResult,
  removePlugin: async (target: PluginTarget): Promise<PluginMutationResult> =>
    await ipcRenderer.invoke(REMOVE_PLUGIN_CHANNEL, target) as PluginMutationResult,
  pickPluginArchive: async (): Promise<string | null> =>
    await ipcRenderer.invoke(PICK_PLUGIN_ARCHIVE_CHANNEL) as string | null,
  restartHarness: async (): Promise<HarnessRestartResult> =>
    await ipcRenderer.invoke(RESTART_HARNESS_CHANNEL) as HarnessRestartResult,
})

contextBridge.exposeInMainWorld('dshDesktop', api)
