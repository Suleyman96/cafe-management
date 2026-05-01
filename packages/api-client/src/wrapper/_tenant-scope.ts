/**
 * Tenant-scope helpers for the wrapper layer (defense-in-depth on top of RLS).
 *
 * Reads: append `.eq('tenant_id', tenantContext.tenantId)` to the query
 * builder. If `tenantId` is null, skip the predicate but optionally log a
 * Sentry warning in development — anon QR flows legitimately have no tenant
 * context until `set_table_context()` runs, so missing context is not a
 * hard error.
 *
 * Writes: assert that any `tenant_id` on the payload matches the context.
 * If both are null/undefined the assertion is a no-op (anon flows write to
 * tables protected by `anon_*` RLS policies that scope correctly).
 */

import { AuthorizationError } from '@gustri/core';
import type { WrapperContext } from './types';

/**
 * Append `.eq('tenant_id', <tenantId>)` to a Supabase query builder when a
 * tenant is bound to the context. Returns the builder unchanged when the
 * context has no tenant — emits a Sentry breadcrumb in development so a
 * missing post-login `setTenantId()` shows up early.
 *
 * `options.allowNull` silences the warning for endpoints that legitimately
 * read without a tenant context (e.g. customer-web menu browsing before the
 * QR session binds).
 *
 * Typed loosely as `any` to avoid TS2589 ("type instantiation excessively
 * deep") on supabase-js's heavily-overloaded `PostgrestFilterBuilder`. The
 * caller's local context preserves the result type.
 */
// `Q` type-erases the supabase-js builder generics; a stricter constraint trips
// TS2589 ("type instantiation excessively deep") on the heavily-overloaded
// `PostgrestFilterBuilder.eq()` signature. The wrapper call site preserves the
// concrete builder type via the generic round-trip.
export function applyTenantScope<Q>(
  query: Q,
  ctx: WrapperContext,
  options?: { allowNull?: boolean },
): Q {
  // Defensive: legacy test fixtures may construct a context without
  // `tenantContext`. Treat that as "no tenant bound" — same as null.
  const tenantId = ctx.tenantContext?.tenantId ?? null;
  if (!tenantId) {
    if (
      !options?.allowNull &&
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV === 'development'
    ) {
      ctx.sentry?.captureMessage('Wrapper read without tenant context', { level: 'warning' });
    }
    return query;
  }
  // The `eq` method exists on every PostgrestFilterBuilder; we cast through
  // a minimal shape so we don't have to import PostgrestFilterBuilder here.
  return (query as unknown as { eq: (column: string, value: string) => Q }).eq(
    'tenant_id',
    tenantId,
  );
}

/**
 * Throws `AuthorizationError` if a payload's `tenant_id` mismatches the
 * context's tenant. Both being null/undefined is allowed (anon writes
 * via `anon_*` RLS policies). Matching values pass through silently.
 */
export function assertInsertTenantMatches<P extends { tenant_id?: string | null }>(
  payload: P,
  ctx: WrapperContext,
): void {
  const ctxTenant = ctx.tenantContext?.tenantId ?? null;
  const payloadTenant = payload.tenant_id;
  if (payloadTenant == null) return;
  if (ctxTenant == null) return;
  if (payloadTenant !== ctxTenant) {
    throw new AuthorizationError(
      `tenant_id on payload (${payloadTenant}) does not match wrapper context (${ctxTenant})`,
    );
  }
}
