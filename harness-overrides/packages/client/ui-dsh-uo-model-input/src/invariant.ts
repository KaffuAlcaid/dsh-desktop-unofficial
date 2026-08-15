/**
 * Package-owned invariant companion for `@dsh-uo/client-ui-model-input`.
 * @module @dsh-uo/client-ui-model-input/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@dsh-uo/client-ui-model-input'

/** Cordis companion plugin name. */
export const name = 'dsh-uo-client-ui-model-input-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Harness already validates and dispatches the model input declaration. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
