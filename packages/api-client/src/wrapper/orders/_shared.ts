/**
 * Internal helpers shared across the orders wrapper submodules
 * (queries / mutations / channels). Not part of the public wrapper API —
 * only `ORDER_VERSION_CONFLICT` is re-exported from the package.
 */

import { ConflictError } from '@gustri/core';
import type { WrapperContext } from '../types';

/**
 * Sentinel surfaced by mutating order methods when an `expectedVersion`
 * does not match the row's current `version` column (migration
 * 20260506000004). Localized in `packages/i18n/src/locales/*\/errors.json`
 * and consumed by the staff-web hooks to render the conflict UI.
 */
export const ORDER_VERSION_CONFLICT = 'version_conflict';

/**
 * The orders_decrypted view adds decrypted_* columns alongside the raw
 * (encrypted) PII columns. This helper maps them back to the standard names
 * so the rest of the app doesn't need to know about encryption.
 */
export function mapDecryptedPii<T extends Record<string, unknown>>(row: T): T {
  if (!row) return row;
  const mapped = { ...row } as Record<string, unknown>;
  if ('decrypted_customer_name' in mapped) {
    mapped.customer_name = mapped.decrypted_customer_name;
    delete mapped.decrypted_customer_name;
  }
  if ('decrypted_customer_phone' in mapped) {
    mapped.customer_phone = mapped.decrypted_customer_phone;
    delete mapped.decrypted_customer_phone;
  }
  if ('decrypted_delivery_address' in mapped) {
    mapped.delivery_address = mapped.decrypted_delivery_address;
    delete mapped.decrypted_delivery_address;
  }
  return mapped as T;
}

export function mapDecryptedPiiArray<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(mapDecryptedPii);
}

/**
 * Refetch the current `version` of an order (or null when the row is hidden
 * by RLS). Used to disambiguate a 0-row UPDATE between an idempotent replay
 * and a real concurrency conflict, and to attach the fresh version to a
 * thrown ConflictError so the UI can offer "Refresh / Override".
 */
export async function fetchCurrentVersion(ctx: WrapperContext, id: string): Promise<number | null> {
  const { data } = await ctx.anyClient.from('orders').select('version').eq('id', id).maybeSingle();
  const v = (data as { version?: number } | null)?.version;
  return typeof v === 'number' ? v : null;
}

export function throwVersionConflict(currentVersion: number | null): never {
  throw new ConflictError(ORDER_VERSION_CONFLICT, {
    currentVersion: currentVersion ?? undefined,
  });
}
