/** DSH-UO per-model reasoning-effort plugin, browser half. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { ReasoningEffortSection } from './ReasoningEffortSection.tsx'
import { en, zh, type ReasoningEffortKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** DSH-UO per-model reasoning-effort copy. */
    'dsh-uo.reasoning-effort': ReasoningEffortKey
  }
}

const NS = 'dsh-uo.reasoning-effort'

/** Required services for locale and model-row slot registration. */
export const inject = ['slots', 'locale']

/** Register the default editor after the Models page declares its model-row slot. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-uo-reasoning-effort: dictionaries')
  ctx.slots.inject('settings.models.model.reasoning', () => ctx.slots.register({
    name: 'settings.models.model.reasoning',
    locale: NS,
  }, ReasoningEffortSection))
}
