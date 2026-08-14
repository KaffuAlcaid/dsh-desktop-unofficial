import { join, resolve } from 'node:path'
import { app, BrowserWindow, Menu, shell } from 'electron'
import { DshServer, type DshExit } from './dsh-process.js'
import { DesktopLogger, errorText } from './logger.js'

const PRODUCT_NAME = 'DSH Desktop Unofficial'

let mainWindow: BrowserWindow | null = null
let dshServer: DshServer | undefined
let logger: DesktopLogger | undefined
let quitting = false
let allowedOrigin: string | undefined

app.setName(PRODUCT_NAME)

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
  const window = createWindow()
  mainWindow = window
  window.on('closed', () => { mainWindow = null })
  await showStatus(window, '正在启动 DSH', '正在准备本地 WebUI...')

  const userData = app.getPath('userData')
  const desktopLogger = new DesktopLogger(join(userData, 'logs', 'dsh-desktop.log'))
  logger = desktopLogger
  desktopLogger.info(
    'desktop',
    `Starting ${PRODUCT_NAME} ${app.getVersion()} (Electron ${process.versions.electron}, Node ${process.versions.node})`,
  )
  const server = new DshServer(
    {
      harnessDir: resolveHarnessDir(),
      homeDir: join(userData, 'dsh-home'),
      workspaceDir: join(userData, 'workspace'),
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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  window.once('ready-to-show', () => { window.show() })
  window.webContents.on('render-process-gone', (_event, details) => {
    logger?.error('electron', `Renderer process gone: ${JSON.stringify(details)}`)
  })
  window.webContents.on('console-message', (_event, details) => {
    const location = details.sourceUrl === '' ? '' : ` (${details.sourceUrl}:${String(details.lineNumber)})`
    const message = `${details.message}${location}`
    if (details.level >= 3) logger?.error('renderer', message)
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
  return resolve(app.getAppPath(), '..', 'deepseek-harness')
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
