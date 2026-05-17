/**
 * Re-export of the shared 10s "now" tick from `@gustri/ui-mobile`. The
 * tick logic moved into the UI package so `TimeElapsed` (now in
 * `@gustri/ui-mobile`) and the rest of the app can share a single store
 * instance — multiple module instances would each ticker their own
 * setInterval and lose the deduplication this hook is for.
 */

export { __resetNowStoreForTests, useNow, useNowStore } from '@gustri/ui-mobile';
