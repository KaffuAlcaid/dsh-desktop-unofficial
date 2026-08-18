// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '../src/client/index.ts'
import { UpstreamStatusAction } from '../src/client/UpstreamStatusAction.tsx'
import type {
  AppUpdateState, DshDesktopApi, HarnessUpstreamStatus,
} from '../src/client/desktop-api.ts'
import { en } from '../src/client/locales.ts'

const t = (key: string, params?: Record<string, unknown>): string => {
  const template = en[key as keyof typeof en] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/gu, (match, name: string) =>
    name in params ? String(params[name]) : match)
}
const neverHook = (() => { throw new Error('component must not read global hooks') }) as never

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'dshDesktop')
})

function mount(wide: boolean) {
  render(<UpstreamStatusAction wide={wide} t={t} useSessions={neverHook} useWorkspaces={neverHook} />)
}

function installBridge(status: HarnessUpstreamStatus): DshDesktopApi {
  const appUpdate = currentAppUpdate()
  const bridge: DshDesktopApi = {
    checkHarnessUpstream: vi.fn().mockResolvedValue({ ok: true, status }),
    getAppUpdateState: vi.fn().mockResolvedValue(appUpdate),
    checkAppUpdate: vi.fn().mockResolvedValue({ ok: true, state: appUpdate }),
    downloadAppUpdate: vi.fn().mockResolvedValue({ ok: true, state: appUpdate }),
    installAppUpdate: vi.fn().mockResolvedValue({ ok: true, state: appUpdate }),
    openAppUpdatePage: vi.fn().mockResolvedValue({ ok: true, state: appUpdate }),
    onAppUpdateState: vi.fn().mockReturnValue(() => {}),
  }
  Object.defineProperty(window, 'dshDesktop', { configurable: true, value: bridge })
  return bridge
}

describe('UpstreamStatusAction', () => {
  it('renders only in the expanded Electron sidebar', () => {
    mount(true)
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    installBridge(currentStatus())
    mount(false)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('checks manually and renders the official commit in the shared modal', async () => {
    const bridge = installBridge(currentStatus())
    mount(true)
    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Check for updates' })).toBeTruthy()
      expect(screen.getAllByText('47f94385')).toHaveLength(2)
      expect(screen.getByText('0.1.0-rc.6')).toBeTruthy()
    })
    expect(bridge.checkHarnessUpstream).toHaveBeenCalledOnce()
  })
})

function currentStatus(): HarnessUpstreamStatus {
  return {
    state: 'current',
    defaultBranch: 'master',
    sourceVersion: '0.1.0-rc.5',
    currentCommit: '47f943859bef60e4160492346772ded9b24f765a',
    latestCommit: '47f943859bef60e4160492346772ded9b24f765a',
    latestTitle: 'Release candidate',
    latestCommittedAt: '2026-08-14T12:00:00.000Z',
    latestUrl: 'https://github.com/deepseek-ai/deepseek-harness/commit/47f943859bef60e4160492346772ded9b24f765a',
    commitsBehind: 0,
    commitsAhead: 0,
    npmPackage: '@deepseek-ai/dsh',
    latestPublishedVersion: '0.1.0-rc.6',
  }
}

function currentAppUpdate(): AppUpdateState {
  return {
    mode: 'installer',
    phase: 'current',
    currentVersion: '0.1.0',
    availableVersion: null,
    releaseName: null,
    releaseNotes: null,
    releaseDate: null,
    releaseUrl: 'https://github.com/KaffuAlcaid/dsh-desktop-unofficial/releases/latest',
    percent: null,
    transferred: null,
    total: null,
    error: null,
  }
}
