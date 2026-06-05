/**
 * Orders wrapper — composition point.
 *
 * The public API (`db.orders.*`) is unchanged; the implementation is split by
 * concern across sibling modules to keep each file focused:
 *   - `queries.ts`   — reads (lists, lookups, realtime catch-up)
 *   - `mutations.ts` — lifecycle writes (create, status, close, cancel, …)
 *   - `channels.ts`  — takeout/delivery channel methods + dispatch transitions
 *   - `_shared.ts`   — internal helpers (PII mapping, version-conflict)
 */

import type { WrapperContext } from '../types';
import { createOrderChannelMethods } from './channels';
import { createOrderMutations } from './mutations';
import { createOrderQueries } from './queries';

export function createOrdersWrapper(ctx: WrapperContext) {
  return {
    ...createOrderQueries(ctx),
    ...createOrderMutations(ctx),
    ...createOrderChannelMethods(ctx),
  };
}

export type OrdersWrapper = ReturnType<typeof createOrdersWrapper>;

// Public sentinel — re-exported from the package root via wrapper/index.ts.
export { ORDER_VERSION_CONFLICT } from './_shared';
