import { spawn, type ChildProcess } from 'node:child_process'
import { access, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { forceTerminateProcessTree, hasExited } from './process-tree.js'

const PROFILE = 'web'
const DEFAULT_OUTPUT_LIMIT = 65_536
const DEFAULT_TIMEOUT_MS = 120_000
const PACKAGE_MANAGER_DIRECTORY = 'pnpm'

/** Runtime paths supplied by the Electron host. This module never owns server restart. */
export interface DshPluginManagerOptions {
  /** Root of the built Harness source or packaged runtime. */
  runtimeDir: string
  /** Node.js executable used to run the bundled DSH CLI. */
  nodeExecutable: string
  /** Value passed to the child process as DSH_HOME. */
  homeDir: string
  /** Directory used to resolve relative local tarball paths. */
  workingDir: string
  /** Maximum retained bytes for each output stream. */
  outputLimitBytes?: number
  /** Maximum time allowed for one DSH command. */
  timeoutMs?: number
  /** Additional environment values, for example a PATH containing pnpm. */
  environment?: NodeJS.ProcessEnv
}

/** Registry package/tag/range or a local plugin package archive. */
export type PluginTarget =
  | { kind: 'npm'; spec: string }
  | { kind: 'tgz'; path: string }

export interface CapturedCommand {
  argv: readonly string[]
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
  timedOut: boolean
  spawnError: string | null
  ok: boolean
}

export interface BundleDeclaration {
  patch: string
  patchPath: string
  patchExists: boolean
}

export interface InstalledPlugin {
  packageName: string
  requestedSpec: string
  installedVersion: string | null
  listedAsBundle: boolean
  bundle: BundleDeclaration | null
  errors: readonly string[]
}

export interface PluginInventory {
  profileDir: string
  bundles: readonly string[]
  plugins: readonly InstalledPlugin[]
  errors: readonly string[]
  valid: boolean
}

export interface DumpConfigValidation {
  command: CapturedCommand
  valid: boolean
}

export interface PluginListResult {
  operation: 'list'
  command: CapturedCommand
  inventory: PluginInventory | null
  ok: boolean
  restartRequired: false
}

export interface PluginMutationResult {
  operation: 'install' | 'update' | 'remove'
  command: CapturedCommand
  inventory: PluginInventory | null
  config: DumpConfigValidation | null
  ok: boolean
  /** The host decides when to restart; this module never restarts DSH itself. */
  restartRequired: boolean
}

interface ProfileManifest {
  dependencies?: Record<string, unknown>
  dsh?: {
    profile?: {
      bundles?: unknown
    }
  }
}

interface PackageManifest {
  name?: unknown
  version?: unknown
  dsh?: {
    bundle?: {
      patch?: unknown
    }
  }
}

/** Official profile-plugin command wrapper for the desktop-owned Web profile. */
export class DshPluginManager {
  private readonly outputLimitBytes: number
  private readonly timeoutMs: number
  private child: ChildProcess | undefined

  constructor(private readonly options: DshPluginManagerOptions) {
    this.outputLimitBytes = positiveInteger(options.outputLimitBytes, DEFAULT_OUTPUT_LIMIT, 'outputLimitBytes')
    this.timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 'timeoutMs')
  }

  async list(): Promise<PluginListResult> {
    const command = await this.runPlugin(['list', '--depth', '0', '--json'])
    const inventory = command.ok ? await this.inspectProfile() : null
    return {
      operation: 'list',
      command,
      inventory,
      ok: command.ok && inventory?.valid === true,
      restartRequired: false,
    }
  }

  async install(target: PluginTarget): Promise<PluginMutationResult> {
    const spec = await this.resolveTargetSpec(target)
    return await this.mutate('install', ['add', spec])
  }

  async update(target: PluginTarget): Promise<PluginMutationResult> {
    const spec = await this.resolveTargetSpec(target)
    // Re-adding a tarball is pnpm's update path for a local package archive.
    const args = target.kind === 'tgz' ? ['add', spec] : ['update', spec]
    return await this.mutate('update', args)
  }

  async remove(target: PluginTarget): Promise<PluginMutationResult> {
    const packageName = target.kind === 'npm'
      ? packageNameFromNpmSpec(target.spec)
      : await this.packageNameForTarball(target.path)
    return await this.mutate('remove', ['remove', packageName])
  }

  /** Stop an in-flight package-manager command before the desktop exits. */
  async stop(): Promise<void> {
    const child = this.child
    if (child === undefined || hasExited(child)) return
    await forceTerminateProcessTree(child)
  }

  /** Compose the profile without booting it; success proves all bundle layers resolve and parse. */
  async validateDumpConfig(): Promise<DumpConfigValidation> {
    const entry = await resolveDshEntry(this.options.runtimeDir)
    const command = await this.run(entry, ['--profile', PROFILE, '--dump-config'])
    return { command, valid: command.ok && command.stdout.trim().length > 0 }
  }

  private async mutate(
    operation: PluginMutationResult['operation'],
    args: readonly string[],
  ): Promise<PluginMutationResult> {
    const command = await this.runPlugin(args)
    if (!command.ok) {
      return { operation, command, inventory: null, config: null, ok: false, restartRequired: false }
    }

    const inventory = await this.inspectProfile()
    const config = inventory.valid ? await this.validateDumpConfig() : null
    const ok = inventory.valid && config?.valid === true
    return { operation, command, inventory, config, ok, restartRequired: ok }
  }

  private async runPlugin(args: readonly string[]): Promise<CapturedCommand> {
    const entry = await resolveDshEntry(this.options.runtimeDir)
    const packageManagerRoot = join(this.options.homeDir, PACKAGE_MANAGER_DIRECTORY)
    return await this.run(entry, ['plugin', '--profile', PROFILE, ...args], {
      npm_config_store_dir: join(packageManagerRoot, 'store'),
      npm_config_cache_dir: join(packageManagerRoot, 'cache'),
      npm_config_state_dir: join(packageManagerRoot, 'state'),
    })
  }

  private async run(
    entry: string,
    args: readonly string[],
    commandEnvironment: NodeJS.ProcessEnv = {},
  ): Promise<CapturedCommand> {
    if (this.child !== undefined && !hasExited(this.child)) {
      throw new Error('The previous plugin command is still running')
    }
    this.child = undefined
    const argv = [entry, ...args]
    return await new Promise<CapturedCommand>((resolvePromise) => {
      const stdout = new BoundedOutput(this.outputLimitBytes)
      const stderr = new BoundedOutput(this.outputLimitBytes)
      let spawnError: string | null = null
      let timedOut = false
      let settled = false

      const child = spawn(this.options.nodeExecutable, argv, {
        cwd: this.options.workingDir,
        env: {
          ...process.env,
          ...this.options.environment,
          ...commandEnvironment,
          PNPM_HOME: join(this.options.homeDir, PACKAGE_MANAGER_DIRECTORY, 'home'),
          XDG_CACHE_HOME: join(this.options.homeDir, PACKAGE_MANAGER_DIRECTORY, 'cache'),
          XDG_CONFIG_HOME: join(this.options.homeDir, PACKAGE_MANAGER_DIRECTORY, 'config'),
          XDG_DATA_HOME: join(this.options.homeDir, PACKAGE_MANAGER_DIRECTORY, 'data'),
          npm_config_cache: join(this.options.homeDir, PACKAGE_MANAGER_DIRECTORY, 'npm-cache'),
          DSH_HOME: this.options.homeDir,
        },
        detached: process.platform !== 'win32',
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      this.child = child

      child.stdout?.on('data', chunk => { stdout.append(chunk as Buffer) })
      child.stderr?.on('data', chunk => { stderr.append(chunk as Buffer) })
      child.once('error', (error) => { spawnError = error.message })

      let timeout: NodeJS.Timeout
      const finish = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolvePromise({
          argv: [this.options.nodeExecutable, ...argv],
          exitCode,
          signal,
          stdout: stdout.text(),
          stderr: stderr.text(),
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
          timedOut,
          spawnError,
          ok: !timedOut && spawnError === null && exitCode === 0,
        })
      }

      timeout = setTimeout(() => {
        timedOut = true
        void forceTerminateProcessTree(child).catch((error: unknown) => {
          spawnError ??= `Unable to stop timed-out plugin command: ${errorMessage(error)}`
          finish(child.exitCode, child.signalCode)
        })
      }, this.timeoutMs)

      child.once('close', (exitCode, signal) => {
        if (this.child === child) this.child = undefined
        finish(exitCode, signal)
      })
    })
  }

  private async inspectProfile(): Promise<PluginInventory> {
    const profileDir = join(this.options.homeDir, 'profiles', PROFILE)
    const profile = await readJson<ProfileManifest>(join(profileDir, 'package.json'))
    const dependencies = stringRecord(profile.dependencies)
    const bundles = stringArray(profile.dsh?.profile?.bundles)
    const profileErrors: string[] = []
    const plugins: InstalledPlugin[] = []

    if (profile.dsh?.profile?.bundles !== undefined && bundles === null) {
      profileErrors.push('dsh.profile.bundles must be an array of package names')
    }
    const bundleNames = bundles ?? []

    for (const [packageName, requestedSpec] of Object.entries(dependencies)) {
      const localPath = localDependencyPath(requestedSpec, profileDir)
      const normalizedRequestedSpec = localPath === null ? requestedSpec : `file:${localPath}`
      const errors: string[] = []
      if (!isPackageName(packageName)) {
        plugins.push({
          packageName,
          requestedSpec: normalizedRequestedSpec,
          installedVersion: null,
          listedAsBundle: bundleNames.includes(packageName),
          bundle: null,
          errors: ['dependency key is not a valid npm package name'],
        })
        continue
      }

      const packageDir = join(profileDir, 'node_modules', ...packageName.split('/'))
      let manifest: PackageManifest
      try {
        manifest = await readJson<PackageManifest>(join(packageDir, 'package.json'))
      } catch (error) {
        plugins.push({
          packageName,
          requestedSpec: normalizedRequestedSpec,
          installedVersion: null,
          listedAsBundle: bundleNames.includes(packageName),
          bundle: null,
          errors: [`installed package manifest is unavailable: ${errorMessage(error)}`],
        })
        continue
      }

      if (manifest.name !== packageName) {
        errors.push(`installed manifest name is ${JSON.stringify(manifest.name)}`)
      }
      const patch = manifest.dsh?.bundle?.patch
      let bundle: BundleDeclaration | null = null
      if (patch !== undefined) {
        if (typeof patch !== 'string' || patch.length === 0) {
          errors.push('dsh.bundle.patch must be a non-empty string')
        } else {
          const patchPath = resolve(packageDir, patch)
          const patchExists = await isFile(patchPath)
          bundle = { patch, patchPath, patchExists }
          if (!patchExists) errors.push(`dsh.bundle.patch does not resolve to a file: ${patch}`)
          if (!bundleNames.includes(packageName)) {
            errors.push('bundle dependency is missing from dsh.profile.bundles')
          }
        }
      } else {
        if (bundleNames.includes(packageName)) {
          errors.push('dsh.profile.bundles entry has no dsh.bundle.patch declaration')
        }
      }

      plugins.push({
        packageName,
        requestedSpec: normalizedRequestedSpec,
        installedVersion: typeof manifest.version === 'string' ? manifest.version : null,
        listedAsBundle: bundleNames.includes(packageName),
        bundle,
        errors,
      })
    }

    const dependencyNames = new Set(Object.keys(dependencies))
    for (const bundleName of bundleNames) {
      // In-box template bundles resolve from the DSH installation, not profile dependencies.
      if (dependencyNames.has(bundleName) || bundleName === '@deepseek-ai/dsh-base'
        || bundleName === '@deepseek-ai/dsh-web-app') continue
      profileErrors.push(`profile bundle is not an installed dependency: ${bundleName}`)
    }

    const valid = profileErrors.length === 0 && plugins.every(plugin => plugin.errors.length === 0)
    return { profileDir, bundles: bundleNames, plugins, errors: profileErrors, valid }
  }

  private async resolveTargetSpec(target: PluginTarget): Promise<string> {
    if (target.kind === 'npm') {
      packageNameFromNpmSpec(target.spec)
      return target.spec
    }
    const path = resolve(this.options.workingDir, target.path)
    if (!path.toLowerCase().endsWith('.tgz')) throw new Error('Local plugin path must end in .tgz')
    if (!await isFile(path)) throw new Error(`Local plugin archive was not found: ${path}`)
    return path
  }

  private async packageNameForTarball(pathValue: string): Promise<string> {
    const targetPath = resolve(this.options.workingDir, pathValue)
    const profileDir = join(this.options.homeDir, 'profiles', PROFILE)
    const profile = await readJson<ProfileManifest>(join(profileDir, 'package.json'))
    const dependencies = stringRecord(profile.dependencies)
    const matches = Object.entries(dependencies).filter(([, spec]) => {
      const dependencyPath = localDependencyPath(spec, profileDir)
      return dependencyPath !== null && sameWindowsPath(dependencyPath, targetPath)
    })
    if (matches.length !== 1 || matches[0] === undefined) {
      throw new Error(`The installed dependency for local archive ${targetPath} could not be identified`)
    }
    return matches[0][0]
  }
}

class BoundedOutput {
  private buffer: Buffer = Buffer.alloc(0)
  private totalBytes = 0

  constructor(private readonly limit: number) {}

  get truncated(): boolean {
    return this.totalBytes > this.limit
  }

  append(chunk: Buffer): void {
    this.totalBytes += chunk.length
    if (chunk.length >= this.limit) {
      this.buffer = chunk.subarray(chunk.length - this.limit)
      return
    }
    const combined = Buffer.concat([this.buffer, chunk])
    this.buffer = combined.length > this.limit ? combined.subarray(combined.length - this.limit) : combined
  }

  text(): string {
    return this.buffer.toString('utf8')
  }
}

async function resolveDshEntry(runtimeDir: string): Promise<string> {
  const candidates = [
    join(runtimeDir, 'apps', 'cli', 'lib', 'bin.js'),
    join(runtimeDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next supported runtime layout.
    }
  }
  throw new Error(`DSH entry was not found under ${runtimeDir}`)
}

function packageNameFromNpmSpec(spec: string): string {
  if (spec.length === 0 || spec.startsWith('-') || /[\0\r\n]/u.test(spec)) {
    throw new Error('Invalid npm plugin spec')
  }
  const slash = spec.indexOf('/')
  const versionAt = spec.startsWith('@') ? spec.indexOf('@', slash + 1) : spec.indexOf('@')
  const packageName = versionAt < 0 ? spec : spec.slice(0, versionAt)
  if (!isPackageName(packageName)) throw new Error(`Invalid npm package name in spec: ${spec}`)
  return packageName
}

function isPackageName(value: string): boolean {
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/iu.test(value)
}

function stringRecord(value: unknown): Record<string, string> {
  if (value === undefined) return {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) return null
  return value
}

function localDependencyPath(spec: string, profileDir: string): string | null {
  if (!spec.startsWith('file:')) return null
  const value = spec.slice('file:'.length)
  if (!value.toLowerCase().endsWith('.tgz')) return null
  return isAbsolute(value) ? resolve(value) : resolve(profileDir, value)
}

function sameWindowsPath(left: string, right: string): boolean {
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

function positiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
