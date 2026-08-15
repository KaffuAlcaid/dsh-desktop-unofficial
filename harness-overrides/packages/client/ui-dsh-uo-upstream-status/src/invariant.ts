/**
 * Package-owned invariant companion for `@dsh-uo/client-ui-upstream-status`.
 * @module @dsh-uo/client-ui-upstream-status/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@dsh-uo/client-ui-upstream-status'

/** Cordis companion plugin name. */
export const name = 'dsh-uo-client-ui-upstream-status-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the plugin holds only dialog-local viewing state and
 * delegates every check to the immutable Electron preload API.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
