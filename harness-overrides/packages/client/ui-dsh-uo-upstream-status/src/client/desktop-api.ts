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

/** Electron API available only inside DSH Desktop Unofficial. */
export interface DshDesktopApi {
  checkHarnessUpstream: () => Promise<HarnessUpstreamCheckResult>
}

declare global {
  interface Window {
    dshDesktop?: DshDesktopApi
  }
}
