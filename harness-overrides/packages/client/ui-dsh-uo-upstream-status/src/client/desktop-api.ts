/** Relationship between the bundled Harness commit and the official default branch. */
export type HarnessUpstreamState = 'current' | 'behind' | 'ahead' | 'diverged'

/** Harness status delivered by the Electron preload API. */
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

/** Result returned for one manual upstream check. */
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

/** Result returned after checking, downloading, installing, or opening a release. */
export type AppUpdateOperationResult =
  | { ok: true; state: AppUpdateState }
  | { ok: false; error: string; state: AppUpdateState }

/** Electron API available only inside DSH Desktop Unofficial. */
export interface DshDesktopApi {
  checkHarnessUpstream: () => Promise<HarnessUpstreamCheckResult>
  getAppUpdateState: () => Promise<AppUpdateState>
  checkAppUpdate: () => Promise<AppUpdateOperationResult>
  downloadAppUpdate: () => Promise<AppUpdateOperationResult>
  installAppUpdate: () => Promise<AppUpdateOperationResult>
  openAppUpdatePage: () => Promise<AppUpdateOperationResult>
  onAppUpdateState: (listener: (state: AppUpdateState) => void) => () => void
}

declare global {
  interface Window {
    dshDesktop?: DshDesktopApi
  }
}
