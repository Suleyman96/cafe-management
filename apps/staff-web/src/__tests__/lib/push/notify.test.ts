/**
 * Push role-targeting: new orders reach kitchen (+ owner/admin as a safety
 * net), waiter calls reach waiters (+ owner/admin). Locks the role sets and
 * the `send-push` invoke contract (tenant_id, data.type, roles).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { notifyNewOrder, notifyNewWaiterCall } from '@/lib/push/notify';

const TENANT = '11111111-1111-4111-8111-111111111111';

/** Minimal admin-client double: a settings read + a `functions.invoke` spy. */
function makeClient() {
  const invoke = vi.fn().mockResolvedValue({ data: { sent: 0 }, error: null });
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { default_language: 'en' }, error: null }),
        }),
      }),
    }),
    functions: { invoke },
  } as unknown as SupabaseClient;
  return { client, invoke };
}

describe('push role-targeting', () => {
  it('sends new-order push to kitchen + owner + admin', async () => {
    const { client, invoke } = makeClient();
    await notifyNewOrder(client, { tenantId: TENANT, orderNumber: 42 });

    expect(invoke).toHaveBeenCalledTimes(1);
    // calls[0] is defined (asserted above); `!` satisfies noUncheckedIndexedAccess.
    const [fn, opts] = invoke.mock.calls[0]!;
    expect(fn).toBe('send-push');
    expect(opts.body.tenant_id).toBe(TENANT);
    expect(opts.body.data.type).toBe('new_order');
    expect(opts.body.roles).toEqual(['kitchen', 'owner', 'admin']);
  });

  it('sends waiter-call push to waiter + owner + admin', async () => {
    const { client, invoke } = makeClient();
    await notifyNewWaiterCall(client, { tenantId: TENANT, tableId: 'table-1' });

    expect(invoke).toHaveBeenCalledTimes(1);
    const [, opts] = invoke.mock.calls[0]!;
    expect(opts.body.data.type).toBe('waiter_call');
    expect(opts.body.roles).toEqual(['waiter', 'owner', 'admin']);
  });

  it('never throws if the push invoke rejects (best-effort)', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('expo down'));
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { default_language: 'en' }, error: null }),
          }),
        }),
      }),
      functions: { invoke },
    } as unknown as SupabaseClient;

    await expect(
      notifyNewOrder(client, { tenantId: TENANT, orderNumber: 1 }),
    ).resolves.toBeUndefined();
  });
});
