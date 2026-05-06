/**
 * Module-level "client is outdated, must reload" state.
 *
 * Backs the Plan 11 hard-block. `VersionSkewWatcher` (in
 * `connection-provider.tsx`) flips this on after a server-SHA mismatch has
 * persisted for >2 min — a brief mismatch during a deploy is normal, but
 * after that window the cached JS is far enough behind production to risk
 * 400s on contract drift, and the user must reload.
 *
 * Implemented as a module-level subscribable rather than a React context so
 * non-React surfaces (e.g. the global mutation cache, future fetch
 * interceptors) can read the flag without hooks. Subscribers are notified
 * on every transition; idempotent setters skip re-fires.
 */

type Listener = (mustReload: boolean) => void;

let mustReload = false;
const listeners = new Set<Listener>();

export function getClientMustReload(): boolean {
  return mustReload;
}

export function setClientMustReload(next: boolean): void {
  if (mustReload === next) return;
  mustReload = next;
  for (const listener of listeners) listener(next);
}

export function subscribeClientMustReload(listener: Listener): () => void {
  listeners.add(listener);
  listener(mustReload);
  return () => {
    listeners.delete(listener);
  };
}

export function __resetClientOutdatedStateForTests(): void {
  mustReload = false;
  listeners.clear();
}
