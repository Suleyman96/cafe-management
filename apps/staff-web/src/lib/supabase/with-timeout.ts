/**
 * Reject if `promise` hasn't settled within `ms`.
 *
 * Layered on top of the fetch-level AbortController in `client.ts` because
 * Supabase's auth library can hang BELOW the fetch layer — IndexedDB lock
 * contention during multi-tab refresh races, or an in-memory deadlock on
 * token rotation. Neither reaches the fetch wrapper, so a watchdog at the
 * auth call site is the only path to recovery.
 *
 * The underlying promise is left dangling on timeout — Supabase auth ops
 * are idempotent, and there's no AbortController on `getSession()` to
 * cancel them with.
 */
export class TimeoutError extends Error {
  readonly label: string;
  readonly ms: number;
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
    this.label = label;
    this.ms = ms;
  }
}

export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
