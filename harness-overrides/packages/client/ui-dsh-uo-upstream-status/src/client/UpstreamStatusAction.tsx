import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button, IconCheckOutline16, IconRefreshOutline16, IconWarningOutline16, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { HarnessUpstreamState, HarnessUpstreamStatus } from './desktop-api.ts'
import css from './UpstreamStatusAction.module.css'

type UpstreamStatusActionProps =
  PropsRuntime<'sidebar.footer.action'> & PropsLocale<'dsh-uo.upstream'>

type ViewState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'success'; status: HarnessUpstreamStatus }
  | { phase: 'error'; message: string }

/**
 * Render the expanded-sidebar update action and its status dialog.
 * @param props - footer owner state and localized copy.
 * @returns null outside Electron and while the sidebar is collapsed.
 */
export function UpstreamStatusAction({ wide, t }: UpstreamStatusActionProps) {
  const bridge = window.dshDesktop
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<ViewState>({ phase: 'idle' })

  if (!wide || bridge === undefined) return null

  const check = async (): Promise<void> => {
    setView({ phase: 'checking' })
    const result = await bridge.checkHarnessUpstream()
    setView(result.ok
      ? { phase: 'success', status: result.status }
      : { phase: 'error', message: result.error })
  }
  const status = view.phase === 'success' ? view.status : undefined
  const tooltip = resolveTooltip(view, t)
  const summary = resolveSummary(view, t)

  return (
    <>
      <Tooltip label={tooltip} side="top" delayMs={500}>
        <button
          type="button"
          className={css.action}
          aria-label={tooltip}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={view.phase === 'checking'}
          onClick={() => {
            setOpen(true)
            void check()
          }}
        >
          <StatusIcon view={view} />
          {status?.state === 'behind' && <span className={css.updateDot} aria-hidden="true" />}
        </button>
      </Tooltip>
      <Modal
        open={open}
        onClose={() => { setOpen(false) }}
        title={t('title')}
        closeLabel={t('close')}
        description={summary}
        className={css.dialog ?? ''}
        footer={(
          <Button
            variant="primary"
            disabled={view.phase === 'checking'}
            icon={<IconRefreshOutline16 className={view.phase === 'checking' ? css.spinning : undefined} />}
            onClick={() => { void check() }}
          >
            {t('retry')}
          </Button>
        )}
      >
        {view.phase === 'checking' && <div className={css.checking}>{t('checking')}</div>}
        {view.phase === 'error' && <div className={css.error}>{view.message}</div>}
        {status !== undefined && <StatusDetails status={status} t={t} />}
      </Modal>
    </>
  )
}

function StatusIcon({ view }: { view: ViewState }) {
  if (view.phase === 'checking') return <IconRefreshOutline16 className={css.spinning} />
  if (view.phase === 'error') return <IconWarningOutline16 />
  if (view.phase === 'success' && view.status.state === 'current') return <IconCheckOutline16 />
  if (view.phase === 'success' && (view.status.state === 'ahead' || view.status.state === 'diverged')) {
    return <IconWarningOutline16 />
  }
  return <IconRefreshOutline16 />
}

function StatusDetails({ status, t }: {
  status: HarnessUpstreamStatus
  t: UpstreamStatusActionProps['t']
}) {
  return (
    <dl className={css.details}>
      <Detail label={t('field.currentVersion')} value={status.currentVersion} />
      <Detail label={t('field.currentCommit')} value={<code>{shortSha(status.currentCommit)}</code>} />
      <Detail label={t('field.branch')} value={status.defaultBranch} />
      <Detail
        label={t('field.latestCommit')}
        value={<a className={css.commitLink} href={status.latestUrl} target="_blank" rel="noreferrer"><code>{shortSha(status.latestCommit)}</code></a>}
      />
      <Detail label={t('field.latestTitle')} value={status.latestTitle} />
      <Detail label={t('field.latestTime')} value={formatDate(status.latestCommittedAt)} />
      <Detail label={t('field.difference')} value={resolveDifference(status, t)} tone={status.state} />
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

function resolveTooltip(view: ViewState, t: UpstreamStatusActionProps['t']): string {
  if (view.phase === 'error') return t('tooltip.error')
  if (view.phase !== 'success') return t('trigger')
  return t(`tooltip.${view.status.state}`)
}

function resolveSummary(view: ViewState, t: UpstreamStatusActionProps['t']): string {
  if (view.phase === 'checking' || view.phase === 'idle') return t('checking')
  if (view.phase === 'error') return t('state.error')
  const status = view.status
  if (status.state === 'behind') return t('state.behind', { count: status.commitsBehind })
  if (status.state === 'ahead') return t('state.ahead', { count: status.commitsAhead })
  return t(`state.${status.state}`)
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(navigator.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
