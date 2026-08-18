import { spawn, type ChildProcess } from 'node:child_process'
import { access, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { errorText, type DesktopLogger } from './logger.js'
import { forceTerminateProcessTree, hasExited, signalProcessTree, waitForExit } from './process-tree.js'

const READY_PATTERN = /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u
const STARTUP_TIMEOUT_MS = 60_000
const SHUTDOWN_TIMEOUT_MS = 6_000
const OUTPUT_LIMIT = 65_536

/** Paths used by the desktop-owned Harness process. */
export interface DshServerOptions {
  /** Root of the built DeepSeek Harness source or packaged runtime. */
  harnessDir: string
  /** Standard Node.js executable used by Harness and its native workers. */
  nodeExecutable: string
  /** Desktop-specific Harness home. */
  homeDir: string
  /** Initial workspace used before the user chooses another directory. */
  workspaceDir: string
}

/** Details retained when a running Harness process exits unexpectedly. */
export interface DshExit {
  code: number | null
  signal: NodeJS.Signals | null
  output: string
}

/** Start and stop the one Harness Web server owned by the Electron process. */
export class DshServer {
  private child: ChildProcess | undefined
  private expectedExit = false
  private output = ''

  constructor(
    private readonly options: DshServerOptions,
    private readonly onUnexpectedExit: (exit: DshExit) => void,
    private readonly logger: DesktopLogger,
  ) {}

  /** Start Harness and resolve after it prints its loopback URL. */
  async start(): Promise<string> {
    if (this.child !== undefined) throw new Error('DSH server has already been started')
    this.expectedExit = false
    this.output = ''

    const entry = await resolveDshEntry(this.options.harnessDir)
    await mkdir(this.options.homeDir, { recursive: true })
    await mkdir(this.options.workspaceDir, { recursive: true })

    this.logger.info('dsh', `Launching ${this.options.nodeExecutable} ${entry}`)
    this.logger.info('dsh', `Home: ${this.options.homeDir}`)
    this.logger.info('dsh', `Workspace: ${this.options.workspaceDir}`)

    const child = spawn(
      this.options.nodeExecutable,
      [entry, 'web', '--host', '127.0.0.1', '--port', '0'],
      {
        cwd: this.options.workspaceDir,
        env: {
          ...process.env,
          DSH_HOME: this.options.homeDir,
        },
        detached: process.platform !== 'win32',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    this.child = child
    this.logger.info('dsh', `Child process started with PID ${String(child.pid ?? 'unknown')}`)

    return await new Promise<string>((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => {
        fail(new Error(`DSH did not become ready within ${String(STARTUP_TIMEOUT_MS / 1000)} seconds`))
      }, STARTUP_TIMEOUT_MS)

      const fail = (error: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        this.expectedExit = true
        void this.stop()
        reject(error)
      }

      const append = (chunk: Buffer | string, stream: 'stdout' | 'stderr'): void => {
        const text = chunk.toString()
        this.output = `${this.output}${text}`.slice(-OUTPUT_LIMIT)
        this.logger.childOutput(stream, chunk)
        if (stream === 'stdout') process.stdout.write(text)
        else process.stderr.write(text)

        if (settled || stream !== 'stdout') return
        const ready = READY_PATTERN.exec(this.output)
        if (ready?.[1] === undefined) return
        settled = true
        clearTimeout(timer)
        resolve(ready[1])
      }

      child.stdout?.on('data', chunk => { append(chunk as Buffer, 'stdout') })
      child.stderr?.on('data', chunk => { append(chunk as Buffer, 'stderr') })
      child.once('error', (error) => {
        this.logger.error('dsh', `Child process error: ${errorText(error)}`)
        fail(new Error(`Unable to start DSH: ${error.message}`))
      })
      child.once('exit', (code, signal) => {
        if (this.child === child) this.child = undefined
        this.logger.info('dsh', `Child process exited (${exitLabel(code, signal)})`)
        if (!settled) {
          fail(new Error(`DSH exited before startup completed (${exitLabel(code, signal)})\n${this.output}`))
          return
        }
        if (!this.expectedExit) this.onUnexpectedExit({ code, signal, output: this.output })
      })
    })
  }

  /** Whether the owned Harness process is still running. */
  isRunning(): boolean {
    return this.child !== undefined && !hasExited(this.child)
  }

  /** Ask Harness to stop and bound how long Electron waits during shutdown. */
  async stop(): Promise<void> {
    this.expectedExit = true
    const child = this.child
    if (child === undefined) return
    if (hasExited(child)) {
      if (this.child === child) this.child = undefined
      return
    }

    this.logger.info('dsh', `Stopping child process PID ${String(child.pid ?? 'unknown')}`)
    if (process.platform === 'win32') {
      await forceTerminateProcessTree(child)
      return
    }
    signalProcessTree(child, 'SIGTERM')
    if (await waitForExit(child, SHUTDOWN_TIMEOUT_MS)) return

    await forceTerminateProcessTree(child)
  }
}

async function resolveDshEntry(harnessDir: string): Promise<string> {
  const candidates = [
    join(harnessDir, 'apps', 'cli', 'lib', 'bin.js'),
    join(harnessDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
  ]
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next supported runtime layout.
    }
  }
  throw new Error(`DSH entry was not found under ${harnessDir}`)
}

function exitLabel(code: number | null, signal: NodeJS.Signals | null): string {
  if (code !== null) return `exit code ${String(code)}`
  return signal === null ? 'unknown exit' : `signal ${signal}`
}
