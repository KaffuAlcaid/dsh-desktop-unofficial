/** DSH-UO system-prompt preset editor, browser half. */
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-agent-preset/client'
import {
  SystemPromptCreate, SystemPromptEdit,
  type SystemPromptCreateInjected, type SystemPromptEditInjected,
} from './SystemPromptControls.tsx'
import { en, zh, type SystemPromptKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** DSH-UO system-prompt editor copy. */
    'dsh-uo.system-prompt': SystemPromptKey
  }
}

const NS = 'dsh-uo.system-prompt'

/** Required services for Host calls, locale, and preset-slot registration. */
export const inject = ['slots', 'locale', 'connection']

/** Register creation and edit controls after ui-agent-preset declares them. */
export function apply(ctx: ClientContext): void {
  const { api } = ctx.get('connection') as ConnectionHandle
  const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-uo-system-prompt: dictionaries')

  const createInjected = (): SystemPromptCreateInjected => ({
    createPreset: async (id, name, text) => {
      let created = false
      try {
        const copied = await api.agentPresets.copy({
          from: 'standard',
          agentPreset: id,
          ...name.trim() === '' ? {} : { name: name.trim() },
        })
        if (!copied.result.ok) return { ok: false, created, message: copied.result.error.message }
        created = true
        const updated = await api.agentPresets.updatePersona({ agentPreset: id, text })
        if (!updated.result.ok) return { ok: false, created, message: updated.result.error.message }
        return { ok: true }
      } catch (error: unknown) {
        return { ok: false, created, message: errorMessage(error) }
      }
    },
  })
  const editInjected = (): SystemPromptEditInjected => ({
    readPrompt: async (agentPreset) => {
      try {
        const response = await api.agentPresets.readPersona({ agentPreset })
        return response.result.ok
          ? { ok: true, text: response.result.value.text }
          : { ok: false, message: response.result.error.message }
      } catch (error: unknown) {
        return { ok: false, message: errorMessage(error) }
      }
    },
    savePrompt: async (agentPreset, text) => {
      try {
        const response = await api.agentPresets.updatePersona({ agentPreset, text })
        return response.result.ok
          ? { ok: true }
          : { ok: false, message: response.result.error.message }
      } catch (error: unknown) {
        return { ok: false, message: errorMessage(error) }
      }
    },
  })

  ctx.slots.inject('settings.agentPreset.create', () => ctx.slots.register({
    name: 'settings.agentPreset.create',
    locale: NS,
    inject: createInjected,
  }, SystemPromptCreate))
  ctx.slots.inject('settings.agentPreset.user.action', () => ctx.slots.register({
    name: 'settings.agentPreset.user.action',
    id: 'system-prompt',
    order: -10,
    locale: NS,
    inject: editInjected,
  }, SystemPromptEdit))
}
