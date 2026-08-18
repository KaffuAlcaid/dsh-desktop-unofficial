import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Button,
  IconFolderOpenOutline16,
  IconPlusOutline16,
  IconRefreshOutline16,
  IconTrashOutline16,
  Input,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  CapturedCommand,
  DshPluginDesktopApi,
  InstalledPlugin,
  PluginMutationResult,
  PluginTarget,
} from './desktop-api.ts'
import css from './PluginManagerTab.module.css'

/** Registration-side desktop face used by the tab. */
export interface PluginManagerTabInjected {
  /** Resolve the optional Electron preload API at call time. */
  desktop: () => DshPluginDesktopApi | undefined
}

/** Full component props assembled by the Settings slot renderer. */
export type PluginManagerTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'dsh-uo.pluginManager'>
  & InjectFace<PluginManagerTabInjected>

type MutationOperation = 'install' | 'update' | 'remove'
type Phase = 'loading' | 'ready' | 'error' | 'working' | 'restarting' | 'unavailable'

interface OperationLogEntry {
  id: number
  operation: 'list' | MutationOperation
  ok: boolean
  command?: CapturedCommand
  message?: string
}

/** Desktop-only user-plugin management tab. */
export function PluginManagerTab({ desktop, t }: PluginManagerTabProps): ReactNode {
  const nextLogId = useRef(1)
  const [request, setRequest] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [activeOperation, setActiveOperation] = useState<MutationOperation | null>(null)
  const [plugins, setPlugins] = useState<readonly InstalledPlugin[]>([])
  const [npmSpec, setNpmSpec] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<readonly OperationLogEntry[]>([])

  const appendLog = (entry: Omit<OperationLogEntry, 'id'>): void => {
    setLogs(current => [...current, { ...entry, id: nextLogId.current++ }])
  }

  useEffect(() => {
    const api = desktop()
    if (api === undefined) {
      setPhase('unavailable')
      return
    }

    let current = true
    setPhase('loading')
    setError(null)
    void api.listPlugins().then(
      (result) => {
        if (!current) return
        if (result.inventory !== null) {
          setPlugins(result.inventory.plugins)
          setPhase('ready')
          if (!result.ok) {
            setError(inventoryFailure(result.inventory.errors, result.inventory.plugins, t('error.invalidProfile')))
            appendLog({ operation: 'list', ok: false, command: result.command })
          }
          return
        }
        setPhase('error')
        setError(commandFailure(result.command, t('error.list')))
        appendLog({ operation: 'list', ok: false, command: result.command })
      },
      (reason: unknown) => {
        if (!current) return
        const message = errorMessage(reason, t('error.list'))
        setPhase('error')
        setError(message)
        appendLog({ operation: 'list', ok: false, message })
      },
    )
    return () => { current = false }
  }, [desktop, request])

  const mutate = async (operation: MutationOperation, target: PluginTarget): Promise<void> => {
    const api = desktop()
    if (api === undefined) {
      setPhase('unavailable')
      return
    }

    setPhase('working')
    setActiveOperation(operation)
    setError(null)
    try {
      const result = await mutationMethod(api, operation)(target)
      appendLog({ operation, ok: result.ok, command: result.command })
      if (result.inventory !== null) setPlugins(result.inventory.plugins)
      if (!result.ok) {
        setError(mutationFailure(result, t(`error.${operation}`)))
        setPhase('ready')
        setActiveOperation(null)
        return
      }

      setNpmSpec('')
      if (result.restartRequired) {
        // The renderer is destroyed by the successful restart. Paint the final
        // state first and deliberately do not depend on this promise settling.
        setPhase('restarting')
        setActiveOperation(null)
        void api.restartHarness().catch(() => {})
        return
      }
      setPhase('ready')
      setActiveOperation(null)
    } catch (reason: unknown) {
      const message = errorMessage(reason, t(`error.${operation}`))
      appendLog({ operation, ok: false, message })
      setError(message)
      setPhase('ready')
      setActiveOperation(null)
    }
  }

  const installNpm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const spec = npmSpec.trim()
    if (spec.length === 0) {
      setError(t('error.emptySpec'))
      return
    }
    void mutate('install', { kind: 'npm', spec })
  }

  const installArchive = async (): Promise<void> => {
    const api = desktop()
    if (api === undefined) {
      setPhase('unavailable')
      return
    }
    try {
      const path = await api.pickPluginArchive()
      if (path !== null) await mutate('install', { kind: 'tgz', path })
    } catch (reason: unknown) {
      const message = errorMessage(reason, t('error.install'))
      appendLog({ operation: 'install', ok: false, message })
      setError(message)
    }
  }

  if (phase === 'restarting') {
    return (
      <div className={css.section} aria-live="polite">
        <div className={css.restarting} role="status">
          <IconRefreshOutline16 className={css.spinning} aria-hidden="true" />
          <strong>{t('restarting')}</strong>
        </div>
      </div>
    )
  }

  if (phase === 'unavailable') {
    return <p className={css.status}>{t('unavailable')}</p>
  }

  if (phase === 'loading') {
    return <p className={css.status} aria-live="polite">{t('loading')}</p>
  }

  if (phase === 'error') {
    return (
      <div className={css.section}>
        <p className={css.error} role="alert">{error ?? t('error.list')}</p>
        <Button variant="outline" size="sm" onClick={() => { setRequest(value => value + 1) }}>
          {t('retry')}
        </Button>
        <OperationLog logs={logs} t={t} />
      </div>
    )
  }

  const busy = phase === 'working'
  const workingLabel = activeOperation === null ? null : t(`working.${activeOperation}`)

  return (
    <div className={css.section} aria-busy={busy}>
      <section className={css.install} aria-labelledby="dsh-uo-plugin-install-heading">
        <h3 id="dsh-uo-plugin-install-heading">{t('install.heading')}</h3>
        <form className={css.npmForm} onSubmit={installNpm}>
          <label className={css.npmField}>
            <span>{t('install.npmLabel')}</span>
            <Input
              value={npmSpec}
              placeholder={t('install.npmPlaceholder')}
              disabled={busy}
              spellCheck={false}
              autoCapitalize="none"
              onChange={(event) => { setNpmSpec(event.currentTarget.value) }}
            />
          </label>
          <Button
            variant="primary"
            icon={<IconPlusOutline16 />}
            disabled={busy || npmSpec.trim().length === 0}
            type="submit"
          >
            {t('install.npmAction')}
          </Button>
          <Button
            variant="outline"
            icon={<IconFolderOpenOutline16 />}
            disabled={busy}
            type="button"
            onClick={() => { void installArchive() }}
          >
            {t('install.localAction')}
          </Button>
        </form>
      </section>

      {workingLabel !== null ? <p className={css.status} aria-live="polite">{workingLabel}</p> : null}
      {error !== null ? <p className={css.error} role="alert">{error}</p> : null}

      <section className={css.catalog} aria-labelledby="dsh-uo-user-plugins-heading">
        <div className={css.catalogHeading}>
          <h3 id="dsh-uo-user-plugins-heading">{t('plugins.heading')}</h3>
          <span>{plugins.length}</span>
        </div>
        {plugins.length === 0 ? <p className={css.status}>{t('plugins.empty')}</p> : (
          <ul className={css.pluginList}>
            {plugins.map(plugin => (
              <PluginRow
                key={plugin.packageName}
                plugin={plugin}
                disabled={busy}
                t={t}
                update={() => { void mutate('update', targetForInstalledPlugin(plugin)) }}
                remove={() => {
                  if (window.confirm(t('removeConfirm', { name: plugin.packageName }))) {
                    void mutate('remove', targetForInstalledPlugin(plugin))
                  }
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <OperationLog logs={logs} t={t} />
    </div>
  )
}

function PluginRow({ plugin, disabled, update, remove, t }: {
  plugin: InstalledPlugin
  disabled: boolean
  update: () => void
  remove: () => void
  t: PluginManagerTabProps['t']
}): ReactNode {
  const status = plugin.errors.length > 0
    ? 'invalid'
    : plugin.listedAsBundle && plugin.bundle?.patchExists === true ? 'active' : 'inactive'
  const updateLabel = t('action.update', { name: plugin.packageName })
  const removeLabel = t('action.remove', { name: plugin.packageName })

  return (
    <li className={css.pluginRow} data-status={status}>
      <div className={css.pluginIdentity}>
        <strong title={plugin.packageName}>{plugin.packageName}</strong>
        <span>{plugin.installedVersion ?? t('version.unknown')}</span>
      </div>
      <span className={css.pluginStatus} data-status={status}>{t(`status.${status}`)}</span>
      <div className={css.rowActions}>
        <Tooltip label={updateLabel} side="top">
          <Button
            className={css.iconButton}
            variant="toolbar"
            size="sm"
            aria-label={updateLabel}
            disabled={disabled}
            icon={<IconRefreshOutline16 />}
            onClick={update}
          />
        </Tooltip>
        <Tooltip label={removeLabel} side="top">
          <Button
            className={css.iconButton}
            variant="toolbar"
            size="sm"
            aria-label={removeLabel}
            disabled={disabled}
            icon={<IconTrashOutline16 />}
            onClick={remove}
          />
        </Tooltip>
      </div>
      {plugin.errors.length > 0 ? (
        <ul className={css.pluginErrors}>
          {plugin.errors.map(message => <li key={message}>{message}</li>)}
        </ul>
      ) : null}
    </li>
  )
}

function OperationLog({ logs, t }: {
  logs: readonly OperationLogEntry[]
  t: PluginManagerTabProps['t']
}): ReactNode {
  if (logs.length === 0) return null
  return (
    <details className={css.log}>
      <summary>{t('log.heading')} ({logs.length})</summary>
      <ol>
        {logs.map(entry => (
          <li key={entry.id} data-ok={entry.ok ? 'true' : 'false'}>
            <div className={css.logTitle}>
              <strong>{t(`log.${entry.operation}`)}</strong>
              <span>{t(entry.ok ? 'log.success' : 'log.failed')}</span>
            </div>
            {entry.message !== undefined ? <pre>{entry.message}</pre> : null}
            {entry.command !== undefined ? <CommandOutput command={entry.command} t={t} /> : null}
          </li>
        ))}
      </ol>
    </details>
  )
}

function CommandOutput({ command, t }: {
  command: CapturedCommand
  t: PluginManagerTabProps['t']
}): ReactNode {
  const stdout = command.stdout.trim()
  const stderr = command.stderr.trim()
  if (stdout.length === 0 && stderr.length === 0 && command.spawnError === null) {
    return <p className={css.noOutput}>{t('log.noOutput')}</p>
  }
  return (
    <div className={css.commandOutput}>
      {command.spawnError !== null ? <pre>{command.spawnError}</pre> : null}
      {stdout.length > 0 ? (
        <section>
          <h4>{t('log.stdout')}{command.stdoutTruncated ? ` (${t('log.truncated')})` : ''}</h4>
          <pre>{stdout}</pre>
        </section>
      ) : null}
      {stderr.length > 0 ? (
        <section>
          <h4>{t('log.stderr')}{command.stderrTruncated ? ` (${t('log.truncated')})` : ''}</h4>
          <pre>{stderr}</pre>
        </section>
      ) : null}
    </div>
  )
}

function mutationMethod(
  api: DshPluginDesktopApi,
  operation: MutationOperation,
): (target: PluginTarget) => Promise<PluginMutationResult> {
  if (operation === 'install') return target => api.installPlugin(target)
  if (operation === 'update') return target => api.updatePlugin(target)
  return target => api.removePlugin(target)
}

function targetForInstalledPlugin(plugin: InstalledPlugin): PluginTarget {
  if (plugin.requestedSpec.startsWith('file:') && plugin.requestedSpec.toLocaleLowerCase().endsWith('.tgz')) {
    return { kind: 'tgz', path: plugin.requestedSpec.slice('file:'.length) }
  }
  return { kind: 'npm', spec: plugin.packageName }
}

function commandFailure(command: CapturedCommand, fallback: string): string {
  return command.stderr.trim()
    || command.spawnError
    || (command.timedOut ? `${fallback}: timed out` : fallback)
}

function mutationFailure(result: PluginMutationResult, fallback: string): string {
  const inventoryMessage = result.inventory === null
    ? ''
    : inventoryFailure(result.inventory.errors, result.inventory.plugins, '')
  return inventoryMessage || commandFailure(result.command, fallback)
}

function inventoryFailure(
  errors: readonly string[],
  plugins: readonly InstalledPlugin[],
  fallback: string,
): string {
  return errors[0]
    ?? plugins.find(plugin => plugin.errors.length > 0)?.errors[0]
    ?? fallback
}

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message.length > 0 ? reason.message : fallback
}
