import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type OpenDialogOptions } from 'electron'
import { ApplicationUpdater } from './app-updater.js'
import type {
  AppUpdateMode, AppUpdateOperationResult, HarnessRestartResult, HarnessUpstreamCheckResult,
} from './desktop-api.js'
import { DshServer, type DshExit } from './dsh-process.js'
import { DesktopLogger, errorText } from './logger.js'
import {
  DshPluginManager, type PluginListResult, type PluginMutationResult, type PluginTarget,
} from './plugin-manager.js'
import { checkHarnessUpstream } from './upstream-status.js'

const PRODUCT_NAME = 'DSH UO'
const PROFILE_NAME = 'DSH Desktop Unofficial'
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
const PORTABLE_MARKER = '.dsh-uo-portable'
const PORTABLE_IMPORT_MARKER = '.appdata-import-checked'
const PORTABLE_FALLBACK_RESET_MARKER = '.appdata-import-fallback-reset'

interface DesktopStorage {
  portable: boolean
  homeDir: string
  workspaceDir: string
  logPath: string | null
  imported: readonly string[]
  initializationError: string | null
}

let mainWindow: BrowserWindow | null = null
let dshServer: DshServer | undefined
let logger: DesktopLogger | undefined
let applicationUpdater: ApplicationUpdater | undefined
let pluginManager: DshPluginManager | undefined
let pluginOperationActive = false
let quitting = false
let nativeQuitAllowed = false
let normalQuitPending = false
let shutdownPromise: Promise<void> | undefined
let allowedOrigin: string | undefined

app.setName(PROFILE_NAME)
const storage = configureDesktopStorage()

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === null) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.on('before-quit', (event) => {
    if (nativeQuitAllowed) return
    event.preventDefault()
    if (normalQuitPending) return
    normalQuitPending = true
    void prepareForNativeQuit('Application shutdown requested')
      .finally(() => {
        nativeQuitAllowed = true
        app.quit()
      })
      .catch(() => {})
  })

  app.on('window-all-closed', () => { app.quit() })

  void app.whenReady().then(startDesktop)
}

async function startDesktop(): Promise<void> {
  Menu.setApplicationMenu(null)
  const window = createWindow()
  mainWindow = window
  window.on('closed', () => { mainWindow = null })
  await showStatus(window, '正在启动 DSH', '正在准备本地 WebUI...')

  if (storage.initializationError !== null) {
    await showStatus(window, '便携数据初始化失败', storage.initializationError, true)
    return
  }

  const logPath = storage.logPath
    ?? join(app.getPath('documents'), 'DSH-UO', 'logs', 'dsh-desktop.log')
  const desktopLogger = new DesktopLogger(logPath)
  logger = desktopLogger
  desktopLogger.info(
    'desktop',
    `Starting ${PRODUCT_NAME} ${app.getVersion()} (Electron ${process.versions.electron}, Node ${process.versions.node})`,
  )
  applicationUpdater = new ApplicationUpdater({
    mode: resolveAppUpdateMode(),
    currentVersion: app.getVersion(),
    logger: desktopLogger,
    beforeInstall: async () => {
      if (pluginOperationActive) throw new Error('请等待当前插件操作完成后再安装更新')
      await prepareForNativeQuit('Application update installation requested')
      nativeQuitAllowed = true
    },
    afterInstallFailure: recoverAfterFailedUpdateInstall,
    onState: (state) => {
      for (const target of BrowserWindow.getAllWindows()) {
        if (!target.isDestroyed()) target.webContents.send(APP_UPDATE_STATE_CHANNEL, state)
      }
    },
  })
  const harnessDir = resolveHarnessDir()
  const nodeExecutable = resolveNodeExecutable()
  pluginManager = new DshPluginManager({
    runtimeDir: harnessDir,
    nodeExecutable,
    homeDir: storage.homeDir,
    workingDir: storage.workspaceDir,
    environment: resolvePluginEnvironment(),
  })
  registerDesktopApi()
  if (storage.imported.length > 0) {
    desktopLogger.info('desktop', `Imported portable data from AppData: ${storage.imported.join(', ')}`)
  }
  const server = new DshServer(
    {
      harnessDir,
      nodeExecutable,
      homeDir: storage.homeDir,
      workspaceDir: storage.workspaceDir,
    },
    handleUnexpectedExit,
    desktopLogger,
  )
  dshServer = server

  try {
    const url = await server.start()
    allowedOrigin = new URL(url).origin
    await window.loadURL(url)
    desktopLogger.info('desktop', `WebUI loaded from ${url}`)
    if (applicationUpdater.getState().mode !== 'unsupported') {
      void applicationUpdater.check()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    desktopLogger.error('desktop', `DSH startup failed: ${errorText(error)}`)
    await showStatus(window, 'DSH 启动失败', message, true)
  }
}

function configureDesktopStorage(): DesktopStorage {
  const installedUserData = app.getPath('userData')
  const installed: DesktopStorage = {
    portable: false,
    homeDir: join(installedUserData, 'dsh-home'),
    workspaceDir: join(installedUserData, 'workspace'),
    logPath: null,
    imported: [],
    initializationError: null,
  }
  const executableDir = dirname(process.execPath)
  if (!app.isPackaged || !existsSync(join(executableDir, PORTABLE_MARKER))) return installed

  const dataRoot = join(executableDir, 'data')
  const imported: string[] = []
  let initializationError: string | null = null
  try {
    mkdirSync(dataRoot, { recursive: true })
    const importMarker = join(dataRoot, PORTABLE_IMPORT_MARKER)
    if (!existsSync(importMarker)) {
      for (const directory of ['dsh-home', 'workspace']) {
        const source = join(installedUserData, directory)
        const destination = join(dataRoot, directory)
        if (!existsSync(source) || existsSync(destination)) continue
        const managedFallback = directory === 'dsh-home'
          ? join(source, 'profiles', 'node_modules')
          : undefined
        copyDirectoryForImport(source, destination, managedFallback)
        imported.push(directory)
      }
      writeFileSync(importMarker, `${new Date().toISOString()}\n`, 'utf8')
    }
    const fallbackResetMarker = join(dataRoot, PORTABLE_FALLBACK_RESET_MARKER)
    if (!existsSync(fallbackResetMarker)) {
      rmSync(join(dataRoot, 'dsh-home', 'profiles', 'node_modules'), { recursive: true, force: true })
      writeFileSync(fallbackResetMarker, `${new Date().toISOString()}\n`, 'utf8')
    }
    const electronUserData = join(dataRoot, 'electron')
    mkdirSync(electronUserData, { recursive: true })
    app.setPath('userData', electronUserData)
  } catch (error) {
    initializationError = `无法初始化便携数据目录 ${dataRoot}\n\n${errorText(error)}`
  }

  return {
    portable: true,
    homeDir: join(dataRoot, 'dsh-home'),
    workspaceDir: join(dataRoot, 'workspace'),
    logPath: join(dataRoot, 'logs', 'dsh-desktop.log'),
    imported,
    initializationError,
  }
}

function copyDirectoryForImport(source: string, destination: string, excludedSource?: string): void {
  const staging = `${destination}.importing`
  const excluded = excludedSource === undefined ? undefined : resolve(excludedSource)
  mkdirSync(staging, { recursive: true })
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    cpSync(join(source, entry.name), join(staging, entry.name), {
      recursive: true,
      force: true,
      filter: currentSource => excluded === undefined || resolve(currentSource) !== excluded,
    })
  }
  renameSync(staging, destination)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#f5f6f7',
    title: PRODUCT_NAME,
    webPreferences: {
      preload: join(app.getAppPath(), 'dist', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  window.once('ready-to-show', () => { window.show() })
  window.webContents.on('render-process-gone', (_event, details) => {
    logger?.error('electron', `Renderer process gone: ${JSON.stringify(details)}`)
  })
  window.webContents.on('console-message', (details) => {
    const location = details.sourceId === '' ? '' : ` (${details.sourceId}:${String(details.lineNumber)})`
    const message = `${details.message}${location}`
    if (details.level === 'error') logger?.error('renderer', message)
    else logger?.info('renderer', message)
  })

  window.webContents.on('will-navigate', (event, target) => {
    if (isAllowedUrl(target)) return
    event.preventDefault()
    openExternal(target)
  })
  window.webContents.on('will-redirect', (event, target) => {
    if (isAllowedUrl(target)) return
    event.preventDefault()
    openExternal(target)
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) void window.loadURL(url)
    else openExternal(url)
    return { action: 'deny' }
  })
  return window
}

function resolveHarnessDir(): string {
  const configured = process.env['DSH_DESKTOP_HARNESS_DIR']?.trim()
  if (configured !== undefined && configured.length > 0) return resolve(configured)
  if (app.isPackaged) return join(process.resourcesPath, 'runtime')
  return join(app.getAppPath(), '.build', 'deepseek-harness')
}

function registerDesktopApi(): void {
  ipcMain.handle(CHECK_HARNESS_UPSTREAM_CHANNEL, async (): Promise<HarnessUpstreamCheckResult> => {
    logger?.info('upstream', 'Checking official Harness repository')
    try {
      const status = await checkHarnessUpstream(resolveHarnessManifestPath())
      logger?.info(
        'upstream',
        `Harness source: ${status.state} (bundled ${status.currentCommit}, official ${status.latestCommit}); npm ${status.latestPublishedVersion}`,
      )
      return { ok: true, status }
    } catch (error) {
      const message = errorText(error)
      logger?.error('upstream', `Harness status check failed: ${message}`)
      return { ok: false, error: message }
    }
  })
  ipcMain.handle(GET_APP_UPDATE_STATE_CHANNEL, () => getApplicationUpdater().getState())
  ipcMain.handle(CHECK_APP_UPDATE_CHANNEL, async (): Promise<AppUpdateOperationResult> =>
    await getApplicationUpdater().check())
  ipcMain.handle(DOWNLOAD_APP_UPDATE_CHANNEL, async (): Promise<AppUpdateOperationResult> =>
    await getApplicationUpdater().download())
  ipcMain.handle(INSTALL_APP_UPDATE_CHANNEL, async (): Promise<AppUpdateOperationResult> =>
    await getApplicationUpdater().install())
  ipcMain.handle(OPEN_APP_UPDATE_PAGE_CHANNEL, async (): Promise<AppUpdateOperationResult> => {
    const updater = getApplicationUpdater()
    try {
      await shell.openExternal(updater.getState().releaseUrl)
      return { ok: true, state: updater.getState() }
    } catch (error) {
      const message = errorText(error)
      logger?.error('update', `Unable to open release page: ${message}`)
      return { ok: false, error: message, state: updater.getState() }
    }
  })
  ipcMain.handle(LIST_PLUGINS_CHANNEL, async (): Promise<PluginListResult> =>
    await runPluginOperation('Listing installed plugins', async manager => await manager.list()))
  ipcMain.handle(
    INSTALL_PLUGIN_CHANNEL,
    async (_event, target: PluginTarget): Promise<PluginMutationResult> =>
      await runPluginOperation('Installing plugin', async manager => await manager.install(target)),
  )
  ipcMain.handle(
    UPDATE_PLUGIN_CHANNEL,
    async (_event, target: PluginTarget): Promise<PluginMutationResult> =>
      await runPluginOperation('Updating plugin', async manager => await manager.update(target)),
  )
  ipcMain.handle(
    REMOVE_PLUGIN_CHANNEL,
    async (_event, target: PluginTarget): Promise<PluginMutationResult> =>
      await runPluginOperation('Removing plugin', async manager => await manager.remove(target)),
  )
  ipcMain.handle(PICK_PLUGIN_ARCHIVE_CHANNEL, async (): Promise<string | null> => {
    const options: OpenDialogOptions = {
      title: '选择 DSH 插件包',
      filters: [{ name: 'DSH 插件包', extensions: ['tgz'] }],
      properties: ['openFile'],
    }
    const result = mainWindow === null
      ? await dialog.showOpenDialog(options)
      : await dialog.showOpenDialog(mainWindow, options)
    return result.canceled ? null : result.filePaths[0] ?? null
  })
  ipcMain.handle(RESTART_HARNESS_CHANNEL, async (): Promise<HarnessRestartResult> => {
    try {
      await runExclusivePluginOperation('Restarting DSH after plugin changes', restartHarness)
      return { ok: true }
    } catch (error) {
      const message = errorText(error)
      logger?.error('plugin', `DSH restart failed: ${message}`)
      return { ok: false, error: message }
    }
  })
}

function getApplicationUpdater(): ApplicationUpdater {
  if (applicationUpdater === undefined) throw new Error('Application updater is not initialized')
  return applicationUpdater
}

function getPluginManager(): DshPluginManager {
  if (pluginManager === undefined) throw new Error('Plugin manager is not initialized')
  return pluginManager
}

async function runPluginOperation<T>(
  description: string,
  operation: (manager: DshPluginManager) => Promise<T>,
): Promise<T> {
  return await runExclusivePluginOperation(description, async () => await operation(getPluginManager()))
}

async function runExclusivePluginOperation<T>(description: string, operation: () => Promise<T>): Promise<T> {
  if (pluginOperationActive) throw new Error('Another plugin operation is still running')
  pluginOperationActive = true
  logger?.info('plugin', description)
  try {
    return await operation()
  } catch (error) {
    logger?.error('plugin', `${description} failed: ${errorText(error)}`)
    throw error
  } finally {
    pluginOperationActive = false
  }
}

async function restartHarness(): Promise<void> {
  if (quitting) throw new Error('The application is shutting down')
  const server = dshServer
  const window = mainWindow
  if (server === undefined || window === null || window.isDestroyed()) {
    throw new Error('DSH is not ready to restart')
  }

  allowedOrigin = undefined
  await showStatus(window, '正在重启 DSH', '插件已更新，正在重新加载本地 WebUI...')
  try {
    await server.stop()
    const url = await server.start()
    allowedOrigin = new URL(url).origin
    await window.loadURL(url)
    logger?.info('plugin', `DSH restarted at ${url}`)
  } catch (error) {
    const message = errorText(error)
    await showStatus(window, 'DSH 重启失败', message, true)
    throw error
  }
}

function resolveAppUpdateMode(): AppUpdateMode {
  if (!app.isPackaged || process.platform !== 'win32') return 'unsupported'
  return storage.portable ? 'portable' : 'installer'
}

function prepareForNativeQuit(message: string): Promise<void> {
  quitting = true
  if (shutdownPromise !== undefined) return shutdownPromise
  logger?.info('desktop', message)
  const currentShutdown = Promise.allSettled([
    pluginManager?.stop() ?? Promise.resolve(),
    dshServer?.stop() ?? Promise.resolve(),
  ]).then((results) => {
    const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failure !== undefined) throw failure.reason
  })
  shutdownPromise = currentShutdown
  void currentShutdown.catch((error: unknown) => {
    logger?.error('desktop', `Unable to stop DSH during shutdown: ${errorText(error)}`)
    if (shutdownPromise === currentShutdown) {
      shutdownPromise = undefined
      quitting = false
    }
  })
  return currentShutdown
}

async function recoverAfterFailedUpdateInstall(): Promise<void> {
  nativeQuitAllowed = false
  shutdownPromise = undefined
  quitting = false

  const server = dshServer
  const window = mainWindow
  if (server === undefined || window === null || window.isDestroyed() || server.isRunning()) return

  allowedOrigin = undefined
  await showStatus(window, '正在恢复 DSH', '更新安装未能启动，正在重新加载本地 WebUI...')
  try {
    const url = await server.start()
    allowedOrigin = new URL(url).origin
    await window.loadURL(url)
    logger?.info('update', `DSH restored after update installation failure at ${url}`)
  } catch (error) {
    await showStatus(window, 'DSH 恢复失败', errorText(error), true)
    throw error
  }
}

function resolveHarnessManifestPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'runtime', 'harness.json')
  return join(app.getAppPath(), 'upstream', 'harness.json')
}

function resolveNodeExecutable(): string {
  const configured = process.env['DSH_DESKTOP_NODE_EXECUTABLE']?.trim()
  if (configured !== undefined && configured.length > 0) return resolve(configured)
  if (app.isPackaged) {
    const filename = process.platform === 'win32' ? 'node.exe' : 'node'
    return join(process.resourcesPath, 'runtime', 'node', filename)
  }
  return 'node'
}

function resolvePluginEnvironment(): NodeJS.ProcessEnv {
  const packageManagerRoot = app.isPackaged
    ? join(process.resourcesPath, 'runtime', 'pnpm')
    : join(app.getAppPath(), 'node_modules', 'pnpm')
  const executableDirectory = app.isPackaged
    ? packageManagerRoot
    : join(app.getAppPath(), 'node_modules', '.bin')
  const pathKey = Object.keys(process.env).find(key => key.toLowerCase() === 'path') ?? 'PATH'
  const currentPath = process.env[pathKey]
  return {
    DSH_DESKTOP_PNPM_CLI: join(packageManagerRoot, 'bin', 'pnpm.cjs'),
    [pathKey]: currentPath === undefined || currentPath.length === 0
      ? executableDirectory
      : `${executableDirectory}${delimiter}${currentPath}`,
  }
}

function isAllowedUrl(target: string): boolean {
  if (allowedOrigin === undefined) return target.startsWith('data:text/html')
  try {
    return new URL(target).origin === allowedOrigin
  } catch {
    return false
  }
}

function openExternal(target: string): void {
  if (!target.startsWith('http://') && !target.startsWith('https://')) return
  void shell.openExternal(target).catch((error: unknown) => {
    logger?.error('desktop', `Unable to open external URL ${target}: ${errorText(error)}`)
    console.error('Unable to open external URL', error)
  })
}

function handleUnexpectedExit(exit: DshExit): void {
  if (quitting || mainWindow === null || mainWindow.isDestroyed()) return
  logger?.error('dsh', `Unexpected exit: ${exitLabel(exit)}`)
  const detail = `${exitLabel(exit)}\n\n${exit.output}`
  void showStatus(mainWindow, 'DSH 已停止', detail, true)
}

function exitLabel(exit: DshExit): string {
  if (exit.code !== null) return `进程退出码：${String(exit.code)}`
  return exit.signal === null ? '进程已退出' : `进程信号：${exit.signal}`
}

async function showStatus(
  window: BrowserWindow,
  title: string,
  detail: string,
  error = false,
): Promise<void> {
  const accent = error ? '#b42318' : '#18794e'
  const visibleDetail = error && logger !== undefined
    ? `${detail}\n\n日志文件：${logger.path}`
    : detail
  const document = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(560px, calc(100vw - 64px)); }
    h1 { margin: 0 0 24px; font-size: 24px; font-weight: 650; letter-spacing: 0; }
    .status { margin: 0 0 10px; color: ${accent}; font-size: 16px; font-weight: 600; }
    pre { margin: 0; max-height: 45vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.6 "Cascadia Mono", Consolas, monospace; color: GrayText; }
  </style>
</head>
<body>
  <main>
    <h1>${PRODUCT_NAME}</h1>
    <p class="status">${escapeHtml(title)}</p>
    <pre>${escapeHtml(visibleDetail)}</pre>
  </main>
</body>
</html>`
  await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(document)}`)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
