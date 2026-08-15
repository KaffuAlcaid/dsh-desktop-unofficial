/**
 * Package-owned invariant companion for `@dsh-uo/client-ui-reasoning-effort`.
 * @module @dsh-uo/client-ui-reasoning-effort/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@dsh-uo/client-ui-reasoning-effort'

/** Cordis companion plugin name. */
export const name = 'dsh-uo-client-ui-reasoning-effort-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: the owner slot validates the stored model mapping. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
