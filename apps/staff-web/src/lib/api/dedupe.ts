import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side idempotent-insert helper for `/api/v1/*` services.
 *
 * Mobile generates a `client_request_id` per logical mutation and replays
 * the payload on relaunch. Without server enforcement, a payment that
 * committed but lost its response would be re-charged on replay. Migration
 * 20260428000002 adds a partial-unique index on
 * `(tenant_id, client_request_id)` for every replay-target table; this
 * helper turns that index into a "run side effects at most once" guarantee.
 *
 * Pattern:
 *  1. Lookup by `(tenant_id, client_request_id)`. If found, return — the
 *     side effects (balance check, stock decrement, etc.) already ran on
 *     the first attempt.
 *  2. Otherwise, run `create()` (the full service body, side effects + insert).
 *  3. On `23505` (a concurrent replay landed first), re-lookup and return.
 *
 * Skip the helper (call `create()` directly) when no `client_request_id`
 * is present — server-originated and legacy callers don't get dedupe.
 */

const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === PG_UNIQUE_VIOLATION;
}

export interface DedupeResult<TRow> {
  row: TRow;
  /** True if the row was returned from a prior commit (replay) rather than a fresh insert. */
  deduped: boolean;
}

export async function findOrCreateByClientRequestId<TRow>(
  client: SupabaseClient,
  args: {
    table: string;
    tenantId: string;
    clientRequestId: string | null | undefined;
    selectShape: string;
    create: () => Promise<TRow>;
  },
): Promise<DedupeResult<TRow>> {
  const { table, tenantId, clientRequestId, selectShape, create } = args;

  if (!clientRequestId) {
    return { row: await create(), deduped: false };
  }

  const { data: existing, error: lookupError } = await client
    .from(table)
    .select(selectShape)
    .eq('tenant_id', tenantId)
    .eq('client_request_id', clientRequestId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing) {
    return { row: existing as TRow, deduped: true };
  }

  try {
    return { row: await create(), deduped: false };
  } catch (err) {
    // Race: a concurrent replay inserted the row between our lookup and
    // our insert. Re-lookup and return that row as deduped.
    if (isUniqueViolation(err)) {
      const { data: raceWinner, error: refetchError } = await client
        .from(table)
        .select(selectShape)
        .eq('tenant_id', tenantId)
        .eq('client_request_id', clientRequestId)
        .single();
      if (refetchError) throw new Error(refetchError.message);
      return { row: raceWinner as TRow, deduped: true };
    }
    throw err;
  }
}

/**
 * Inspect a thrown error for the Postgres unique-violation code, looking
 * one level into wrapped messages because some services throw new Error()
 * and lose the `.code` property. Service code that wraps errors should
 * preserve the original instead of re-throwing — but until we audit every
 * service, this fallback covers the legacy paths.
 */
export function isClientRequestIdConflict(err: unknown): boolean {
  if (isUniqueViolation(err)) return true;
  const message = (err as { message?: string } | null)?.message ?? '';
  return message.includes('client_request_id') && message.includes('duplicate');
}
