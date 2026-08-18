/** DSH-UO plugin-manager Settings tab, browser half. */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { getPluginDesktopApi } from './desktop-api.ts'
import { PluginManagerTab, type PluginManagerTabInjected } from './PluginManagerTab.tsx'
import { en, zh, type PluginManagerLocaleKey } from './locales.ts'

export type { PluginManagerTabInjected, PluginManagerTabProps } from './PluginManagerTab.tsx'
export type {
  CapturedCommand,
  DshPluginDesktopApi,
  InstalledPlugin,
  PluginInventory,
  PluginListResult,
  PluginMutationResult,
  PluginTarget,
} from './desktop-api.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** DSH-UO user-plugin management copy. */
    'dsh-uo.pluginManager': PluginManagerLocaleKey
  }
}

const NS = 'dsh-uo.pluginManager'

/** Required services for locale and Settings-tab registration. */
export const inject = ['slots', 'locale']

/** Register the desktop-only management page under Settings > Plugins. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-uo-plugin-manager: dictionaries')
  const t = ctx.locale.bind(NS)
  const injected = (): PluginManagerTabInjected => ({ desktop: getPluginDesktopApi })

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'dsh-uo-manage',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: injected,
  }, PluginManagerTab))
}
