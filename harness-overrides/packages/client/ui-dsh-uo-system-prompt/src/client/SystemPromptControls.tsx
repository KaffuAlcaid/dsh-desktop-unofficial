import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Button, IconEditOutline16, IconPlusOutline16, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-agent-preset/client'
import css from './SystemPromptControls.module.css'

/** Result of the two-step preset creation operation. */
export type CreatePromptResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly created: boolean }

/** Result of a persona read. */
export type ReadPromptResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly message: string }

/** Result of a persona update. */
export type SavePromptResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string }

/** Registration-side actions for the creation entry. */
export interface SystemPromptCreateInjected {
  createPreset: (id: string, name: string, text: string) => Promise<CreatePromptResult>
}

/** Registration-side actions for one user-preset card. */
export interface SystemPromptEditInjected {
  readPrompt: (id: string) => Promise<ReadPromptResult>
  savePrompt: (id: string, text: string) => Promise<SavePromptResult>
}

export type SystemPromptCreateProps =
  & PropsRuntime<'settings.agentPreset.create'>
  & PropsLocale<'dsh-uo.system-prompt'>
  & InjectFace<SystemPromptCreateInjected>

export type SystemPromptEditProps =
  & PropsRuntime<'settings.agentPreset.user.action'>
  & PropsLocale<'dsh-uo.system-prompt'>
  & InjectFace<SystemPromptEditInjected>

const PRESET_ID = /^[a-z0-9][a-z0-9-]*$/

/** Creation entry placed above the official Creator-mode action. */
export function SystemPromptCreate(props: SystemPromptCreateProps): ReactNode {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = (): void => {
    setOpen(false)
    setId('')
    setName('')
    setText('')
    setSaving(false)
    setCreated(false)
    setError(null)
  }
  const idError = id === ''
    ? props.t('idRequired')
    : !PRESET_ID.test(id)
        ? props.t('idInvalid')
        : props.presetIds.includes(id) ? props.t('idTaken') : undefined

  const submit = async (): Promise<void> => {
    if (idError !== undefined || saving || created) return
    setSaving(true)
    setError(null)
    const result = await props.createPreset(id, name, text)
    setSaving(false)
    if (!result.ok) {
      setCreated(result.created)
      if (result.created) await props.refresh()
      setError(`${result.created ? props.t('createdButPromptFailed') : props.t('copyFailed')} ${result.message}`)
      return
    }
    await props.refresh()
    reset()
  }

  return (
    <>
      <button
        type="button"
        className={css.createButton}
        disabled={!props.authorable}
        title={props.authorable ? undefined : props.t('unavailable')}
        onClick={() => { setOpen(true) }}
      >
        <IconPlusOutline16 size={14} />
        {props.t('create')}
      </button>
      <Modal
        open={open}
        onClose={reset}
        title={props.t('createTitle')}
        closeLabel={props.t('close')}
        className={css.dialog as string}
        footer={(
          <>
            <Button variant="outline" disabled={saving} onClick={reset}>
              {created ? props.t('close') : props.t('cancel')}
            </Button>
            <Button disabled={saving || created || idError !== undefined} onClick={() => { void submit() }}>
              {saving ? props.t('saving') : props.t('save')}
            </Button>
          </>
        )}
      >
        <div className={css.fields}>
          <label className={css.field}>
            <span>{props.t('identifier')}</span>
            <input
              value={id}
              autoFocus
              spellCheck={false}
              disabled={saving || created}
              placeholder={props.t('identifierPlaceholder')}
              onChange={(event) => { setId(event.target.value); setError(null) }}
            />
          </label>
          <label className={css.field}>
            <span>{props.t('name')}</span>
            <input
              value={name}
              disabled={saving || created}
              placeholder={props.t('namePlaceholder')}
              onChange={(event) => { setName(event.target.value) }}
            />
          </label>
          <label className={css.field}>
            <span>{props.t('prompt')}</span>
            <textarea
              value={text}
              disabled={saving || created}
              placeholder={props.t('promptPlaceholder')}
              onChange={(event) => { setText(event.target.value) }}
            />
          </label>
          {id !== '' && idError !== undefined ? <p className={css.error} role="alert">{idError}</p> : null}
          {error === null ? null : <p className={css.error} role="alert">{error}</p>}
        </div>
      </Modal>
    </>
  )
}

/** Pencil action contributed to each user preset card. */
export function SystemPromptEdit(props: SystemPromptEditProps): ReactNode {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = (): void => {
    setOpen(false)
    setLoading(false)
    setReady(false)
    setSaving(false)
    setError(null)
  }
  const begin = async (): Promise<void> => {
    setOpen(true)
    setLoading(true)
    setReady(false)
    setError(null)
    const result = await props.readPrompt(props.agentPreset)
    setLoading(false)
    if (result.ok) {
      setText(result.text)
      setReady(true)
    }
    else setError(`${props.t('loadFailed')} ${result.message}`)
  }
  const save = async (): Promise<void> => {
    if (loading || saving || !ready) return
    setSaving(true)
    setError(null)
    const result = await props.savePrompt(props.agentPreset, text)
    setSaving(false)
    if (result.ok) close()
    else setError(`${props.t('saveFailed')} ${result.message}`)
  }

  return (
    <>
      <Tooltip label={props.t('edit')} side="top" delayMs={300}>
        <button
          type="button"
          className={css.iconButton}
          aria-label={`${props.t('edit')}: ${props.title}`}
          onClick={() => { void begin() }}
        >
          <IconEditOutline16 />
        </button>
      </Tooltip>
      <Modal
        open={open}
        onClose={close}
        title={`${props.t('editTitle')} · ${props.title}`}
        closeLabel={props.t('close')}
        className={css.dialog as string}
        footer={(
          <>
            <Button variant="outline" disabled={saving} onClick={close}>{props.t('cancel')}</Button>
            <Button disabled={loading || saving || !ready} onClick={() => { void save() }}>
              {saving ? props.t('saving') : props.t('save')}
            </Button>
          </>
        )}
      >
        {loading
          ? <p className={css.loading}>{props.t('loading')}</p>
          : (
            <div className={css.fields}>
              <label className={css.field}>
                <span>{props.t('prompt')}</span>
                <textarea
                  value={text}
                  autoFocus
                  disabled={saving || !ready}
                  onChange={(event) => { setText(event.target.value); setError(null) }}
                />
              </label>
              {error === null ? null : <p className={css.error} role="alert">{error}</p>}
            </div>
          )}
      </Modal>
    </>
  )
}
