import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button, IconCheckOutline16, IconDownloadOutline16, IconRefreshOutline16,
  IconWarningOutline16, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  AppUpdateState, HarnessUpstreamState, HarnessUpstreamStatus,
} from './desktop-api.ts'
import css from './UpstreamStatusAction.module.css'

type UpstreamStatusActionProps =
  PropsRuntime<'sidebar.footer.action'> & PropsLocale<'dsh-uo.upstream'>

type HarnessView =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'success'; status: HarnessUpstreamStatus }
  | { phase: 'error'; message: string }

/** Render the expanded-sidebar application and Harness update action. */
export function UpstreamStatusAction({ wide, t }: UpstreamStatusActionProps) {
  const bridge = window.dshDesktop
  const [open, setOpen] = useState(false)
  const [harnessView, setHarnessView] = useState<HarnessView>({ phase: 'idle' })
  const [appUpdate, setAppUpdate] = useState<AppUpdateState>()
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (bridge === undefined) return
    let active = true
    const unsubscribe = bridge.onAppUpdateState((state) => {
      if (active) setAppUpdate(state)
    })
    void bridge.getAppUpdateState().then(
      state => { if (active) setAppUpdate(state) },
      error => { if (active) setActionError(messageOf(error)) },
    )
    return () => {
      active = false
      unsubscribe()
    }
  }, [bridge])

  if (!wide || bridge === undefined) return null

  const check = async (): Promise<void> => {
    setHarnessView({ phase: 'checking' })
    setActionError(null)
    try {
      const [harnessResult, updateResult] = await Promise.all([
        bridge.checkHarnessUpstream(),
        bridge.checkAppUpdate(),
      ])
      setHarnessView(harnessResult.ok
        ? { phase: 'success', status: harnessResult.status }
        : { phase: 'error', message: harnessResult.error })
      setAppUpdate(updateResult.state)
      if (!updateResult.ok && updateResult.state.error === null) {
        setActionError(updateResult.error)
      }
    } catch (error) {
      const message = messageOf(error)
      setHarnessView({ phase: 'error', message })
      setActionError(message)
    }
  }

  const runAppAction = async (): Promise<void> => {
    if (appUpdate === undefined) return
    setActionError(null)
    const action = resolveAppAction(appUpdate)
    if (action === null) return
    try {
      const result = action === 'install'
        ? await bridge.installAppUpdate()
        : action === 'download'
          ? await bridge.downloadAppUpdate()
          : await bridge.openAppUpdatePage()
      setAppUpdate(result.state)
      if (!result.ok) setActionError(result.error)
    } catch (error) {
      setActionError(messageOf(error))
    }
  }

  const appAction = appUpdate === undefined ? null : resolveAppAction(appUpdate)
  const busy = harnessView.phase === 'checking'
    || appUpdate?.phase === 'checking'
    || appUpdate?.phase === 'downloading'
    || appUpdate?.phase === 'installing'
  const status = harnessView.phase === 'success' ? harnessView.status : undefined
  const updateAvailable = appUpdate?.phase === 'available' || appUpdate?.phase === 'downloaded'

  return (
    <>
      <button
        type="button"
        className={css.action}
        aria-label={t('trigger')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
          void check()
        }}
      >
        <StatusIcon appUpdate={appUpdate} harnessView={harnessView} />
        <span className={css.actionLabel}>{t('trigger')}</span>
        {(updateAvailable || (status !== undefined && hasUpstreamDifference(status)))
          && <span className={css.updateDot} aria-hidden="true" />}
      </button>
      <Modal
        open={open}
        onClose={() => { setOpen(false) }}
        title={t('title')}
        closeLabel={t('close')}
        description={t('description')}
        className={css.dialog ?? ''}
        footer={(
          <div className={css.footerActions}>
            {appAction !== null && (
              <Button
                variant="primary"
                disabled={busy}
                icon={appAction === 'download'
                  ? <IconDownloadOutline16 />
                  : <IconRefreshOutline16 />}
                onClick={() => { void runAppAction() }}
              >
                {t(`app.action.${appAction === 'open' ? 'openPage' : appAction}`)}
              </Button>
            )}
            <Button
              variant="outline"
              disabled={busy}
              icon={<IconRefreshOutline16 className={busy ? css.spinning : undefined} />}
              onClick={() => { void check() }}
            >
              {t('retry')}
            </Button>
          </div>
        )}
      >
        <section className={css.section}>
          <h3 className={css.sectionTitle}>{t('app.title')}</h3>
          {appUpdate === undefined
            ? <div className={css.checking}>{t('app.loading')}</div>
            : <AppUpdateDetails state={appUpdate} t={t} />}
          {actionError !== null && <div className={css.error}>{actionError}</div>}
        </section>
        <section className={css.section}>
          <h3 className={css.sectionTitle}>{t('harness.title')}</h3>
          {harnessView.phase === 'idle' && <div className={css.checking}>{t('checking')}</div>}
          {harnessView.phase === 'checking' && <div className={css.checking}>{t('checking')}</div>}
          {harnessView.phase === 'error' && <div className={css.error}>{harnessView.message}</div>}
          {status !== undefined && (
            <>
              <p className={css.summary}>{resolveHarnessSummary(harnessView, t)}</p>
              <HarnessStatusDetails status={status} t={t} />
            </>
          )}
        </section>
      </Modal>
    </>
  )
}

function AppUpdateDetails({ state, t }: {
  state: AppUpdateState
  t: UpstreamStatusActionProps['t']
}) {
  const summary = resolveAppSummary(state, t)
  return (
    <>
      <p className={css.summary} data-tone={state.phase === 'error' ? 'error' : undefined}>{summary}</p>
      <dl className={css.details}>
        <Detail label={t('app.field.currentVersion')} value={state.currentVersion} />
        <Detail label={t('app.field.distribution')} value={t(`app.mode.${state.mode}`)} />
        {state.availableVersion !== null && (
          <Detail label={t('app.field.availableVersion')} value={state.availableVersion} />
        )}
      </dl>
      {state.phase === 'downloading' && (
        <div className={css.progressRow}>
          <progress max={100} value={state.percent ?? 0} aria-label={summary} />
          <span>{String(Math.round(state.percent ?? 0))}%</span>
        </div>
      )}
      {state.releaseNotes !== null && (
        <div className={css.releaseNotes}>
          <h4>{t('app.releaseNotes')}</h4>
          <p>{state.releaseNotes}</p>
        </div>
      )}
      {state.error !== null && <div className={css.error}>{state.error}</div>}
    </>
  )
}

function StatusIcon({ appUpdate, harnessView }: {
  appUpdate: AppUpdateState | undefined
  harnessView: HarnessView
}) {
  if (harnessView.phase === 'checking' || appUpdate?.phase === 'checking') {
    return <IconRefreshOutline16 className={css.spinning} />
  }
  if (harnessView.phase === 'error' || appUpdate?.phase === 'error') return <IconWarningOutline16 />
  if (appUpdate?.phase === 'current'
    && harnessView.phase === 'success'
    && harnessView.status.state === 'current'
    && harnessView.status.sourceVersion === harnessView.status.latestPublishedVersion) {
    return <IconCheckOutline16 />
  }
  return <IconRefreshOutline16 />
}

function HarnessStatusDetails({ status, t }: {
  status: HarnessUpstreamStatus
  t: UpstreamStatusActionProps['t']
}) {
  return (
    <dl className={css.details}>
      <Detail label={t('field.sourceVersion')} value={status.sourceVersion} />
      <Detail label={t('field.currentCommit')} value={<code>{shortSha(status.currentCommit)}</code>} />
      <Detail label={t('field.branch')} value={status.defaultBranch} />
      <Detail
        label={t('field.latestCommit')}
        value={<a className={css.commitLink} href={status.latestUrl} target="_blank" rel="noreferrer"><code>{shortSha(status.latestCommit)}</code></a>}
      />
      <Detail label={t('field.difference')} value={resolveDifference(status, t)} tone={status.state} />
      <Detail label={t('field.npmPackage')} value={<code>{status.npmPackage}</code>} />
      <Detail label={t('field.publishedVersion')} value={status.latestPublishedVersion} />
    </dl>
  )
}

function Detail({ label, value, tone }: {
  label: string
  value: ReactNode
  tone?: HarnessUpstreamState
}) {
  return (
    <div className={css.detailRow}>
      <dt>{label}</dt>
      <dd data-tone={tone}>{value}</dd>
    </div>
  )
}

function resolveAppAction(state: AppUpdateState): 'download' | 'install' | 'open' | null {
  if (state.phase === 'downloaded' && state.mode === 'installer') return 'install'
  if (state.phase !== 'available') return null
  return state.mode === 'installer' ? 'download' : 'open'
}

function resolveAppSummary(state: AppUpdateState, t: UpstreamStatusActionProps['t']): string {
  if (state.mode === 'unsupported') return t('app.state.unsupported')
  if (state.phase === 'available') {
    const key = state.mode === 'portable'
      ? 'app.state.availablePortable'
      : 'app.state.availableInstaller'
    return t(key, { version: state.availableVersion ?? '' })
  }
  if (state.phase === 'downloading') {
    return t('app.state.downloading', {
      version: state.availableVersion ?? '',
      percent: Math.round(state.percent ?? 0),
    })
  }
  if (state.phase === 'downloaded') {
    return t('app.state.downloaded', { version: state.availableVersion ?? '' })
  }
  return t(`app.state.${state.phase}`)
}

function resolveHarnessSummary(view: HarnessView, t: UpstreamStatusActionProps['t']): string {
  if (view.phase === 'checking' || view.phase === 'idle') return t('checking')
  if (view.phase === 'error') return t('state.error')
  const status = view.status
  if (status.state === 'behind') return t('state.behind', { count: status.commitsBehind })
  if (status.state === 'ahead') return t('state.ahead', { count: status.commitsAhead })
  if (status.state === 'diverged') return t('state.diverged')
  if (hasPublishedDifference(status)) {
    return t('state.publishedDifferent', { publishedVersion: status.latestPublishedVersion })
  }
  return t(`state.${status.state}`)
}

function hasPublishedDifference(status: HarnessUpstreamStatus): boolean {
  return status.sourceVersion !== status.latestPublishedVersion
}

function hasUpstreamDifference(status: HarnessUpstreamStatus): boolean {
  return status.state !== 'current' || hasPublishedDifference(status)
}

function resolveDifference(status: HarnessUpstreamStatus, t: UpstreamStatusActionProps['t']): string {
  if (status.state === 'behind') return t('difference.behind', { count: status.commitsBehind })
  if (status.state === 'ahead') return t('difference.ahead', { count: status.commitsAhead })
  if (status.state === 'diverged') {
    return t('difference.diverged', { behind: status.commitsBehind, ahead: status.commitsAhead })
  }
  return t('difference.current')
}

function shortSha(value: string): string {
  return value.slice(0, 8)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
