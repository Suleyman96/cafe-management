import { useMemo, useRef } from 'react';
import { randomUUIDv4 } from './idempotency';

/**
 * Per-form stable `client_request_id` for money mutations.
 *
 * Mutations carry a `client_request_id` that the server uses to dedupe
 * retries via `(tenant_id, client_request_id)` partial unique indexes.
 * The mutation hooks stamp a fresh id in `onMutate` if the caller doesn't
 * provide one — but with `retry: 0` (Blocker 2) every user-driven retry
 * IS a fresh `mutate()` invocation, which would mint a *new* id and bypass
 * the dedupe path.
 *
 * This hook hands the form a key that survives across retries of the same
 * logical submit and is reset only after the submit succeeds (or the form
 * unmounts). Use it like:
 *
 * ```ts
 * const idempotencyKey = useStableClientRequestId();
 * const onSubmit = () => mutate(
 *   { ...form, client_request_id: idempotencyKey.get() },
 *   { onSuccess: () => idempotencyKey.reset() },
 * );
 * ```
 *
 * `get()` is lazy — no UUID is minted until the user actually submits, so
 * a mounted-but-unused form costs nothing.
 */
export function useStableClientRequestId() {
  const ref = useRef<string | null>(null);

  // Memoize the entire returned object so its reference is stable across
  // renders. Callers regularly thread this object into a `useEffect`
  // dependency array (e.g. SplitPaymentModal resets it on isOpen toggle);
  // a fresh object literal each render would re-fire the effect every
  // commit and, when the effect calls setState, infinite-loop the render.
  return useMemo(
    () => ({
      get: () => {
        if (ref.current === null) {
          ref.current = randomUUIDv4();
        }
        return ref.current;
      },
      reset: () => {
        ref.current = null;
      },
    }),
    [],
  );
}

export type StableClientRequestId = ReturnType<typeof useStableClientRequestId>;
