/**
 * Service-level coverage for the deferred multi-tenant SSR fix from
 * `plans/18-CUSTOMER-WEB-AUDIT-CONTINUATION.md`.
 *
 * Contract under test: `resolveCustomerQrToken` is the trust boundary
 * that turns a customer-supplied `qr_token` into a `tenant_id`. Three
 * gates have to run in order: token-shape lookup, revocation/expiry/
 * kind validation, and the same `PLAN_LIMITS[plan].qrOrdering` plan
 * gate that customer-orders / customer-engagement enforce. Anything
 * past those returns `{ tenant_id }` and the customer-web wrapper
 * uses it to scope subsequent `useMenuItems` / `useCategories` reads.
 */

import { ValidationError } from '@gustri/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { resolveCustomerQrToken } from '@/lib/services/customer-qr-token-service';

const TENANT = '11111111-1111-4111-8111-111111111111';
const TOKEN = 'tkn_valid_1234567890';

interface QueuedResponse {
  data: unknown;
  error: unknown;
}

function buildClient(plan: Record<string, QueuedResponse[]>): SupabaseClient {
  const cursor: Record<string, number> = {};
  function next(table: string): QueuedResponse {
    const queue = plan[table] ?? [];
    const i = cursor[table] ?? 0;
    cursor[table] = i + 1;
    return queue[i] ?? { data: null, error: { message: `unexpected ${table}[${i}]` } };
  }
  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const chain =
        () =>
        (..._args: unknown[]) =>
          builder;
      for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
        builder[m] = chain();
      }
      builder.maybeSingle = () => Promise.resolve(next(table));
      builder.single = () => Promise.resolve(next(table));
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('resolveCustomerQrToken', () => {
  it('returns the tenant_id for a valid token on a plan that allows qrOrdering', async () => {
    const client = buildClient({
      qr_tokens: [
        {
          data: { tenant_id: TENANT, kind: 'delivery', expires_at: null, revoked_at: null },
          error: null,
        },
      ],
      tenants: [{ data: { plan: 'standard' }, error: null }],
    });

    await expect(resolveCustomerQrToken(client, { qr_token: TOKEN })).resolves.toEqual({
      tenant_id: TENANT,
    });
  });

  it('rejects an unknown token with invalid_qr_token', async () => {
    const client = buildClient({
      qr_tokens: [{ data: null, error: null }],
    });

    await expect(
      resolveCustomerQrToken(client, { qr_token: 'tkn_unknown' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a revoked token with invalid_qr_token (no leak about WHY)', async () => {
    // Plan 18 trade-off: collapse all three failure modes into one
    // sentinel so the customer UI can show a single "Invalid QR" message
    // without burning 60 locale entries on three near-identical strings.
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            kind: 'delivery',
            expires_at: null,
            revoked_at: new Date('2026-04-01').toISOString(),
          },
          error: null,
        },
      ],
    });

    await expect(resolveCustomerQrToken(client, { qr_token: TOKEN })).rejects.toThrow(
      /invalid_qr_token/,
    );
  });

  it('rejects an expired token with invalid_qr_token', async () => {
    const client = buildClient({
      qr_tokens: [
        {
          data: {
            tenant_id: TENANT,
            kind: 'delivery',
            // 2026-01-01 is already in the past relative to the suite's
            // 2026-05-07 system date — expired.
            expires_at: new Date('2026-01-01').toISOString(),
            revoked_at: null,
          },
          error: null,
        },
      ],
    });

    await expect(resolveCustomerQrToken(client, { qr_token: TOKEN })).rejects.toThrow(
      /invalid_qr_token/,
    );
  });

  it('rejects tokens of the wrong kind (e.g. takeout token used on the delivery flow)', async () => {
    // Each `kind` (`dine_in`, `takeout`, `delivery`) has its own
    // resolution path; reusing a token across kinds is treated as
    // invalid. Pinning this contract here so a future refactor that
    // tries to "share" tokens has a failing test to revisit.
    const client = buildClient({
      qr_tokens: [
        {
          data: { tenant_id: TENANT, kind: 'takeout', expires_at: null, revoked_at: null },
          error: null,
        },
      ],
    });

    await expect(resolveCustomerQrToken(client, { qr_token: TOKEN })).rejects.toThrow(
      /invalid_qr_token/,
    );
  });

  it('rejects with plan_required when the resolved tenant disables qrOrdering (free)', async () => {
    const client = buildClient({
      qr_tokens: [
        {
          data: { tenant_id: TENANT, kind: 'delivery', expires_at: null, revoked_at: null },
          error: null,
        },
      ],
      tenants: [{ data: { plan: 'free' }, error: null }],
    });

    await expect(resolveCustomerQrToken(client, { qr_token: TOKEN })).rejects.toThrow(
      /plan_required/,
    );
  });
});
