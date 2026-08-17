import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import type { HarnessUpstreamCheckResult } from './desktop-api.js'
import { DshServer, type DshExit } from './dsh-process.js'
import { DesktopLogger, errorText } from './logger.js'
import { checkHarnessUpstream } from './upstream-status.js'

const PRODUCT_NAME = 'DSH UO'
const PROFILE_NAME = 'DSH Desktop Unofficial'
const CHECK_HARNESS_UPSTREAM_CHANNEL = 'dsh-desktop:check-harness-upstream'
const PORTABLE_MARKER = '.dsh-uo-portable'
const PORTABLE_IMPORT_MARKER = '.appdata-import-checked'
const PORTABLE_FALLBACK_RESET_MARKER = '.appdata-import-fallback-reset'

interface DesktopStorage {
  homeDir: string
  workspaceDir: string
  logPath: string | null
  imported: readonly string[]
  initializationError: string | null
}

let mainWindow: BrowserWindow | null = null
let dshServer: DshServer | undefined
let logger: DesktopLogger | undefined
let quitting = false
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
    if (quitting) return
    event.preventDefault()
    quitting = true
    logger?.info('desktop', 'Application shutdown requested')
    const stopped = dshServer?.stop() ?? Promise.resolve()
    void stopped.finally(() => { app.exit(0) })
  })

  app.on('window-all-closed', () => { app.quit() })

  void app.whenReady().then(startDesktop)
}

async function startDesktop(): Promise<void> {
  Menu.setApplicationMenu(null)
  registerDesktopApi()
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
  if (storage.imported.length > 0) {
    desktopLogger.info('desktop', `Imported portable data from AppData: ${storage.imported.join(', ')}`)
  }
  const server = new DshServer(
    {
      harnessDir: resolveHarnessDir(),
      nodeExecutable: resolveNodeExecutable(),
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    desktopLogger.error('desktop', `DSH startup failed: ${errorText(error)}`)
    await showStatus(window, 'DSH 启动失败', message, true)
  }
}

function configureDesktopStorage(): DesktopStorage {
  const installedUserData = app.getPath('userData')
  const installed: DesktopStorage = {
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
