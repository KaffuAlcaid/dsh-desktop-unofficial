import { spawn, type ChildProcess } from 'node:child_process'

/** Whether a child has already reported an exit status or signal. */
export function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

/** Wait for one child exit without leaving an event listener behind on timeout. */
export function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (hasExited(child)) return Promise.resolve(true)
  return new Promise((resolve) => {
    const onExit = (): void => {
      clearTimeout(timer)
      resolve(true)
    }
    const timer = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)
    child.once('exit', onExit)
  })
}

/** Signal a detached POSIX process group, or one process on Windows. */
export function signalProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (hasExited(child)) return
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, signal)
    } catch (error) {
      if (!hasExited(child)) throw error
    }
    return
  }
  child.kill(signal)
}

/** Force-stop an owned process tree, then prove the root exited. */
export async function forceTerminateProcessTree(child: ChildProcess, timeoutMs = 2_000): Promise<void> {
  if (hasExited(child)) return

  if (process.platform === 'win32' && child.pid !== undefined) {
    try {
      await runTaskkill(child.pid, timeoutMs)
    } catch (error) {
      if (!hasExited(child)) throw error
    }
  } else {
    signalProcessTree(child, 'SIGKILL')
  }

  if (!await waitForExit(child, timeoutMs)) {
    throw new Error(`Process ${String(child.pid ?? 'unknown')} did not exit after forced termination`)
  }
}

function runTaskkill(pid: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const taskkill = spawn('taskkill.exe', ['/pid', String(pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error === undefined) resolve()
      else reject(error)
    }
    taskkill.once('error', finish)
    taskkill.once('close', (code) => {
      finish(code === 0 ? undefined : new Error(`taskkill exited with code ${String(code)}`))
    })
    const timer = setTimeout(() => {
      taskkill.kill()
      finish(new Error(`taskkill did not finish within ${String(timeoutMs)} ms`))
    }, timeoutMs)
  })
}
