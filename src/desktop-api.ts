import type {
  PluginListResult, PluginMutationResult, PluginTarget,
} from './plugin-manager.js'

/** Relationship between the bundled Harness commit and the official default branch. */
export type HarnessUpstreamState = 'current' | 'behind' | 'ahead' | 'diverged'

/** Official Harness status returned to the isolated WebUI renderer. */
export interface HarnessUpstreamStatus {
  state: HarnessUpstreamState
  defaultBranch: string
  sourceVersion: string
  currentCommit: string
  latestCommit: string
  latestTitle: string
  latestCommittedAt: string
  latestUrl: string
  commitsBehind: number
  commitsAhead: number
  npmPackage: string
  latestPublishedVersion: string
}

/** IPC result keeps expected network failures inside the rendered status panel. */
export type HarnessUpstreamCheckResult =
  | { ok: true; status: HarnessUpstreamStatus }
  | { ok: false; error: string }

/** Update behavior selected from the packaged Windows distribution. */
export type AppUpdateMode = 'installer' | 'portable' | 'unsupported'

/** Observable application-update lifecycle exposed to the WebUI. */
export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

/** Serializable snapshot of the DSH UO release updater. */
export interface AppUpdateState {
  mode: AppUpdateMode
  phase: AppUpdatePhase
  currentVersion: string
  availableVersion: string | null
  releaseName: string | null
  releaseNotes: string | null
  releaseDate: string | null
  releaseUrl: string
  percent: number | null
  transferred: number | null
  total: number | null
  error: string | null
}

/** Result of one update operation; failures remain renderable in the dialog. */
export type AppUpdateOperationResult =
  | { ok: true; state: AppUpdateState }
  | { ok: false; error: string; state: AppUpdateState }

/** Result returned before the renderer is replaced by a restarted Harness page. */
export type HarnessRestartResult =
  | { ok: true }
  | { ok: false; error: string }

/** Narrow renderer API exposed by the sandboxed preload script. */
export interface DshDesktopApi {
  checkHarnessUpstream: () => Promise<HarnessUpstreamCheckResult>
  getAppUpdateState: () => Promise<AppUpdateState>
  checkAppUpdate: () => Promise<AppUpdateOperationResult>
  downloadAppUpdate: () => Promise<AppUpdateOperationResult>
  installAppUpdate: () => Promise<AppUpdateOperationResult>
  openAppUpdatePage: () => Promise<AppUpdateOperationResult>
  onAppUpdateState: (listener: (state: AppUpdateState) => void) => () => void
  listPlugins: () => Promise<PluginListResult>
  installPlugin: (target: PluginTarget) => Promise<PluginMutationResult>
  updatePlugin: (target: PluginTarget) => Promise<PluginMutationResult>
  removePlugin: (target: PluginTarget) => Promise<PluginMutationResult>
  pickPluginArchive: () => Promise<string | null>
  restartHarness: () => Promise<HarnessRestartResult>
}
