/**
 * Tenant-context defense-in-depth tests (H5).
 *
 * Asserts that:
 *  - Reads append `.eq('tenant_id', <tenantId>)` when bound.
 *  - Reads with no tenant context emit a Sentry warning in dev (and don't
 *    add the predicate — anon flows legitimately read without one).
 *  - Insert payloads with a mismatched `tenant_id` throw AuthorizationError.
 *  - Insert payloads with matching `tenant_id` (or both null) pass through.
 */

import { AuthorizationError } from '@gustri/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTenantScope, assertInsertTenantMatches } from '../wrapper/_tenant-scope';
import { createOrdersWrapper } from '../wrapper/orders';
import { createMockContext } from './helpers/mock-supabase';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

describe('tenant-context wrapper scoping', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('appends .eq(tenant_id) when context has a tenant id', async () => {
    const ctx = createMockContext({
      tenantId: TENANT_A,
      responses: {
        orders_decrypted: { data: [], error: null },
      },
    });
    const orders = createOrdersWrapper(ctx as never);
    await orders.findAll({ limit: 50 });

    type Call = { table: string; method: string; args: unknown[] };
    const eqCalls = (ctx.getCalls() as Call[]).filter(
      (c) => c.method === 'eq' && c.args[0] === 'tenant_id',
    );
    expect(eqCalls).toHaveLength(1);
    expect(eqCalls[0].args[1]).toBe(TENANT_A);
  });

  it('skips the predicate and warns in dev when tenant context is null', async () => {
    const captureMessage = vi.fn();
    const ctx = createMockContext({
      tenantId: null,
      sentry: { captureMessage },
      responses: {
        orders_decrypted: { data: [], error: null },
      },
    });
    const orders = createOrdersWrapper(ctx as never);
    await orders.findAll({ limit: 50 });

    type Call = { table: string; method: string; args: unknown[] };
    const eqCalls = (ctx.getCalls() as Call[]).filter(
      (c) => c.method === 'eq' && c.args[0] === 'tenant_id',
    );
    expect(eqCalls).toHaveLength(0);
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringMatching(/without tenant context/),
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('allowNull suppresses the dev warning for anon flows', () => {
    const captureMessage = vi.fn();
    const ctx = createMockContext({
      tenantId: null,
      sentry: { captureMessage },
    });

    const fakeBuilder = {
      eq: vi.fn().mockReturnThis(),
    };
    applyTenantScope(fakeBuilder, ctx as never, { allowNull: true });

    expect(fakeBuilder.eq).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('assertInsertTenantMatches throws when payload tenant differs', () => {
    const ctx = createMockContext({ tenantId: TENANT_A });
    expect(() => assertInsertTenantMatches({ tenant_id: TENANT_B }, ctx as never)).toThrow(
      AuthorizationError,
    );
  });

  it('assertInsertTenantMatches accepts matching tenant id', () => {
    const ctx = createMockContext({ tenantId: TENANT_A });
    expect(() => assertInsertTenantMatches({ tenant_id: TENANT_A }, ctx as never)).not.toThrow();
  });

  it('assertInsertTenantMatches accepts a payload without tenant_id', () => {
    const ctx = createMockContext({ tenantId: TENANT_A });
    expect(() => assertInsertTenantMatches({}, ctx as never)).not.toThrow();
  });

  it('assertInsertTenantMatches is a no-op when both context and payload are null', () => {
    const ctx = createMockContext({ tenantId: null });
    expect(() => assertInsertTenantMatches({ tenant_id: null }, ctx as never)).not.toThrow();
  });
});
