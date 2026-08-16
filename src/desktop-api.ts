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

/** Narrow renderer API exposed by the sandboxed preload script. */
export interface DshDesktopApi {
  checkHarnessUpstream: () => Promise<HarnessUpstreamCheckResult>
}
