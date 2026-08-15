/** DSH-UO per-model input-capability plugin, browser half. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import { ModelInputSection } from './ModelInputSection.tsx'
import { en, zh, type ModelInputKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** DSH-UO per-model input-capability copy. */
    'dsh-uo.model-input': ModelInputKey
  }
}

const NS = 'dsh-uo.model-input'

/** Required services for locale and model-row slot registration. */
export const inject = ['slots', 'locale']

/** Register the editor after the Models page declares its model-row slot. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-uo-model-input: dictionaries')
  ctx.slots.inject('settings.models.model.input', () => ctx.slots.register({
    name: 'settings.models.model.input',
    locale: NS,
  }, ModelInputSection))
}
