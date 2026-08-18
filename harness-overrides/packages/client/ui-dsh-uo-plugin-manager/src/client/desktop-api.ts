/** Registry package/tag/range or a local plugin archive selected by the user. */
export type PluginTarget =
  | { kind: 'npm'; spec: string }
  | { kind: 'tgz'; path: string }

/** Captured DSH command result returned by Electron. */
export interface CapturedCommand {
  argv: readonly string[]
  exitCode: number | null
  signal: string | null
  stdout: string
  stderr: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
  timedOut: boolean
  spawnError: string | null
  ok: boolean
}

/** Bundle declaration inspected from an installed package. */
export interface BundleDeclaration {
  patch: string
  patchPath: string
  patchExists: boolean
}

/** One user dependency from the desktop-owned Web profile. */
export interface InstalledPlugin {
  packageName: string
  requestedSpec: string
  installedVersion: string | null
  listedAsBundle: boolean
  bundle: BundleDeclaration | null
  errors: readonly string[]
}

/** Current user-plugin inventory. Built-in bundles are intentionally absent. */
export interface PluginInventory {
  profileDir: string
  bundles: readonly string[]
  plugins: readonly InstalledPlugin[]
  errors: readonly string[]
  valid: boolean
}

/** Result of reading the profile's user dependencies. */
export interface PluginListResult {
  operation: 'list'
  command: CapturedCommand
  inventory: PluginInventory | null
  ok: boolean
  restartRequired: false
}

/** Result of an install, update, or remove followed by bundle validation. */
export interface PluginMutationResult {
  operation: 'install' | 'update' | 'remove'
  command: CapturedCommand
  inventory: PluginInventory | null
  config: { command: CapturedCommand; valid: boolean } | null
  ok: boolean
  restartRequired: boolean
}

/** Electron preload methods required by this client package. */
export interface DshPluginDesktopApi {
  listPlugins: () => Promise<PluginListResult>
  installPlugin: (target: PluginTarget) => Promise<PluginMutationResult>
  updatePlugin: (target: PluginTarget) => Promise<PluginMutationResult>
  removePlugin: (target: PluginTarget) => Promise<PluginMutationResult>
  pickPluginArchive: () => Promise<string | null>
  restartHarness: () => Promise<{ ok: true } | { ok: false; error: string }>
}

/** Read the optional desktop bridge without extending the shared Window declaration. */
export function getPluginDesktopApi(): DshPluginDesktopApi | undefined {
  return (window as Window & { dshDesktop?: DshPluginDesktopApi }).dshDesktop
}
