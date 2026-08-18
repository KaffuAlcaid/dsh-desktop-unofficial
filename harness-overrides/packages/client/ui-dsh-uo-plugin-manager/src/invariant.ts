/**
 * Package-owned invariant companion for `@dsh-uo/client-ui-plugin-manager`.
 * @module @dsh-uo/client-ui-plugin-manager/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@dsh-uo/client-ui-plugin-manager'

/** Cordis companion plugin name. */
export const name = 'dsh-uo-client-ui-plugin-manager-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Electron owns plugin operations; this package only contributes the UI. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
