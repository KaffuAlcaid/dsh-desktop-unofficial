import electronUpdater from 'electron-updater'
import type { UpdateInfo } from 'electron-updater'
import type {
  AppUpdateMode, AppUpdateOperationResult, AppUpdateState,
} from './desktop-api.js'
import { errorText, type DesktopLogger } from './logger.js'

const { autoUpdater } = electronUpdater

const RELEASES_URL = 'https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases'
const UPDATE_PROVIDER = {
  provider: 'github' as const,
  owner: 'KaffuAlcaid',
  repo: 'dsh-desktop-unofficial',
}

/** Main-process application updater with distribution-specific install behavior. */
export class ApplicationUpdater {
  private state: AppUpdateState
  private checkPromise: Promise<AppUpdateOperationResult> | undefined
  private installRecoveryPromise: Promise<void> | undefined

  constructor(private readonly options: {
    mode: AppUpdateMode
    currentVersion: string
    logger: DesktopLogger
    beforeInstall: () => Promise<void>
    afterInstallFailure: () => Promise<void>
    onState: (state: AppUpdateState) => void
  }) {
    this.state = {
      mode: options.mode,
      phase: 'idle',
      currentVersion: options.currentVersion,
      availableVersion: null,
      releaseName: null,
      releaseNotes: null,
      releaseDate: null,
      releaseUrl: `${RELEASES_URL}/latest`,
      percent: null,
      transferred: null,
      total: null,
      error: null,
    }

    if (options.mode === 'unsupported') return
    autoUpdater.setFeedURL(UPDATE_PROVIDER)
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.on('checking-for-update', () => {
      this.update({ phase: 'checking', error: null })
    })
    autoUpdater.on('update-available', (info) => {
      this.options.logger.info('update', `DSH UO ${info.version} is available`)
      this.updateFromInfo('available', info)
    })
    autoUpdater.on('update-not-available', () => {
      this.options.logger.info('update', `DSH UO ${this.options.currentVersion} is current`)
      this.update({
        phase: 'current',
        availableVersion: null,
        releaseName: null,
        releaseNotes: null,
        releaseDate: null,
        releaseUrl: `${RELEASES_URL}/latest`,
        percent: null,
        transferred: null,
        total: null,
        error: null,
      })
    })
    autoUpdater.on('download-progress', (progress) => {
      this.update({
        phase: 'downloading',
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        error: null,
      })
    })
    autoUpdater.on('update-downloaded', (info) => {
      this.options.logger.info('update', `DSH UO ${info.version} was downloaded`)
      this.updateFromInfo('downloaded', info)
    })
    autoUpdater.on('error', (error) => {
      if (this.state.phase === 'installing') {
        void this.recoverInstallFailure(error)
        return
      }
      const message = errorText(error)
      this.options.logger.error('update', message)
      this.update({ phase: 'error', error: message })
    })
  }

  getState(): AppUpdateState {
    return { ...this.state }
  }

  check(): Promise<AppUpdateOperationResult> {
    if (this.options.mode === 'unsupported') {
      return Promise.resolve(this.success())
    }
    if (this.state.phase === 'downloading'
      || this.state.phase === 'downloaded'
      || this.state.phase === 'installing') {
      return Promise.resolve(this.success())
    }
    if (this.checkPromise !== undefined) return this.checkPromise
    this.checkPromise = this.runCheck().finally(() => { this.checkPromise = undefined })
    return this.checkPromise
  }

  async download(): Promise<AppUpdateOperationResult> {
    if (this.options.mode !== 'installer') {
      return this.failure('This distribution opens the release page instead of replacing its files.')
    }
    if (this.state.phase !== 'available') {
      return this.failure('No application update is ready to download.')
    }

    this.update({ phase: 'downloading', percent: 0, transferred: 0, total: null, error: null })
    try {
      await autoUpdater.downloadUpdate()
      return this.success()
    } catch (error) {
      return this.recordFailure(error)
    }
  }

  async install(): Promise<AppUpdateOperationResult> {
    if (this.options.mode !== 'installer') {
      return this.failure('Portable packages never run the NSIS update installer.')
    }
    if (this.state.phase !== 'downloaded') {
      return this.failure('The application update has not finished downloading.')
    }

    this.update({ phase: 'installing', error: null })
    try {
      await this.options.beforeInstall()
      autoUpdater.quitAndInstall(false, true)
      return this.success()
    } catch (error) {
      return await this.recoverInstallFailure(error)
    }
  }

  private async runCheck(): Promise<AppUpdateOperationResult> {
    this.options.logger.info('update', `Checking DSH UO releases (${this.options.mode})`)
    this.update({ phase: 'checking', error: null })
    try {
      await autoUpdater.checkForUpdates()
      if (this.state.phase === 'checking') {
        return this.recordFailure(new Error('The update service did not return a version result.'))
      }
      return this.success()
    } catch (error) {
      return this.recordFailure(error)
    }
  }

  private updateFromInfo(phase: 'available' | 'downloaded', info: UpdateInfo): void {
    this.update({
      phase,
      availableVersion: info.version,
      releaseName: info.releaseName ?? null,
      releaseNotes: formatReleaseNotes(info.releaseNotes),
      releaseDate: info.releaseDate ?? null,
      releaseUrl: `${RELEASES_URL}/tag/v${encodeURIComponent(info.version)}`,
      percent: phase === 'downloaded' ? 100 : null,
      transferred: phase === 'downloaded' ? this.state.total : null,
      total: phase === 'downloaded' ? this.state.total : null,
      error: null,
    })
  }

  private update(patch: Partial<AppUpdateState>): void {
    this.state = { ...this.state, ...patch }
    this.options.onState(this.getState())
  }

  private success(): AppUpdateOperationResult {
    return { ok: true, state: this.getState() }
  }

  private failure(message: string): AppUpdateOperationResult {
    return { ok: false, error: message, state: this.getState() }
  }

  private recordFailure(error: unknown): AppUpdateOperationResult {
    const message = errorText(error)
    this.options.logger.error('update', message)
    this.update({ phase: 'error', error: message })
    return this.failure(message)
  }

  private async recoverInstallFailure(error: unknown): Promise<AppUpdateOperationResult> {
    let message = errorText(error)
    let recovery = this.installRecoveryPromise
    if (recovery === undefined) {
      recovery = this.options.afterInstallFailure()
      this.installRecoveryPromise = recovery
    }
    try {
      await recovery
    } catch (recoveryError) {
      message = `${message}\nUnable to restore DSH after the failed update: ${errorText(recoveryError)}`
    } finally {
      if (this.installRecoveryPromise === recovery) this.installRecoveryPromise = undefined
    }
    this.options.logger.error('update', `Unable to install update: ${message}`)
    this.update({ phase: 'downloaded', error: message })
    return this.failure(message)
  }
}

function formatReleaseNotes(notes: UpdateInfo['releaseNotes']): string | null {
  if (typeof notes === 'string') return notes.trim() || null
  if (!Array.isArray(notes)) return null
  const text = notes
    .map(item => typeof item.note === 'string' ? item.note.trim() : '')
    .filter(Boolean)
    .join('\n\n')
  return text || null
}
