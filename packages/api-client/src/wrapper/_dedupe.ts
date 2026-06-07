/**
 * Idempotent-insert helper for wrapper `.create()` methods.
 *
 * Migration 20260428000002 adds a partial-unique index on
 * `(tenant_id, client_request_id)` for every replay-target table. A second
 * insert with the same key violates the index (PG 23505) — we treat that as
 * "the operation already succeeded once" and re-SELECT the original row so
 * callers see the same response a successful first attempt would have
 * produced.
 *
 * Mobile generates the key in `apps/mobile/src/lib/idempotency.ts` and
 * threads it through React Query's persisted mutation cache. Server routes
 * follow the same pattern in `apps/staff-web/src/app/api/v1/*`.
 */

import { handleSupabaseError } from '../errors';

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === PG_UNIQUE_VIOLATION;
}

/**
 * Run an insert, falling back to a tenant-scoped SELECT when the insert
 * trips the (tenant_id, client_request_id) unique index. RLS scopes the
 * refetch to the caller's tenant, so the row matching `client_request_id`
 * is unambiguous.
 *
 * Pass `null/undefined` for `clientRequestId` to disable the dedupe path
 * (legacy or non-replayable callers): a conflict then throws normally.
 *
 * Caller responsibility: shape `refetch` to return the same row shape as
 * `insert` (joins, column subset, etc.) — this helper does not normalize.
 */
export async function dedupeInsert<TRow>(
  clientRequestId: string | null | undefined,
  ops: {
    insert: () => PromiseLike<{ data: TRow | null; error: unknown }>;
    refetch: () => PromiseLike<{ data: TRow | null; error: unknown }>;
  },
): Promise<TRow> {
  const inserted = await ops.insert();

  if (!inserted.error) {
    if (inserted.data == null) {
      throw new Error('Insert returned no row');
    }
    return inserted.data;
  }

  if (clientRequestId && isUniqueViolation(inserted.error)) {
    const fetched = await ops.refetch();
    if (fetched.error) throw handleSupabaseError(fetched.error);
    if (fetched.data == null) {
      // Insert claimed a duplicate but RLS hides the row from us — don't
      // paper over: surface the original conflict so callers see a real
      // error rather than a phantom success.
      throw handleSupabaseError(inserted.error);
    }
    return fetched.data;
  }

  throw handleSupabaseError(inserted.error);
}

/**
 * Batch-insert variant of `dedupeInsert`. Each row carries its own
 * `client_request_id`; on replay the entire batch trips the unique index
 * and we refetch by the full id list. RLS scopes the SELECT to the
 * caller's tenant so a single `IN` clause is enough.
 *
 * Caller contract: either every row has a `client_request_id`, or none do.
 * Mixed batches fall back to non-deduped behavior (a real conflict will
 * throw normally) — mobile is expected to stamp consistently.
 */
export async function dedupeInsertMany<TRow>(
  clientRequestIds: ReadonlyArray<string | null | undefined>,
  ops: {
    insert: () => PromiseLike<{ data: TRow[] | null; error: unknown }>;
    refetchByIds: (ids: string[]) => PromiseLike<{ data: TRow[] | null; error: unknown }>;
  },
): Promise<TRow[]> {
  const inserted = await ops.insert();

  if (!inserted.error) {
    return inserted.data ?? [];
  }

  const definedIds = clientRequestIds.filter((id): id is string => typeof id === 'string');
  const allRowsKeyed = clientRequestIds.length > 0 && definedIds.length === clientRequestIds.length;

  if (allRowsKeyed && isUniqueViolation(inserted.error)) {
    const fetched = await ops.refetchByIds(definedIds);
    if (fetched.error) throw handleSupabaseError(fetched.error);
    // A clean idempotent replay re-fetches EVERY row (one per client_request_id).
    // A shorter result means a *partial* conflict — only some ids existed, so the
    // atomic batch insert rolled back the non-conflicting rows and they were never
    // persisted. Returning that subset would silently drop rows the caller asked
    // to insert, so surface the original error instead.
    if (fetched.data == null || fetched.data.length !== definedIds.length) {
      throw handleSupabaseError(inserted.error);
    }
    return fetched.data;
  }

  throw handleSupabaseError(inserted.error);
}
