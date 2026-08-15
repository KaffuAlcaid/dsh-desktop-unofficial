/** DSH-UO upstream-status sidebar plugin, browser half. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { UpstreamStatusAction } from './UpstreamStatusAction.tsx'
import { en, zh, type UpstreamStatusKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** DSH-UO Harness upstream-status copy. */
    'dsh-uo.upstream': UpstreamStatusKey
  }
}

const NS = 'dsh-uo.upstream'

/** Required services for locale and sidebar-slot registration. */
export const inject = ['slots', 'locale']

/**
 * Register the desktop-only status action after the sidebar declares its footer slot.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-uo-upstream: dictionaries')
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'dsh-uo-upstream-status',
    order: 0,
    locale: NS,
  }, UpstreamStatusAction))
}
