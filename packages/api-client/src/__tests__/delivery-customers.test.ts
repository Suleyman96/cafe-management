/**
 * Wrapper-level checks for the PII protections added in
 * 20260503000005_encrypt_delivery_customer_phone.sql.
 *
 * The schema is the primary boundary (encrypted-at-rest column, role-gated
 * decrypted view, hashed-phone RPC, column-level grants). These tests
 * cover the wrapper's contract on top of that:
 *
 *   - List endpoints never select phone-bearing columns.
 *   - Phone search routes through the RPC, not a LIKE on plaintext.
 *   - findById reads from the decrypted view and surfaces whatever the
 *     view returns (NULL for non-admin, plaintext for admin).
 */

import { describe, expect, it } from 'vitest';
import { createDeliveryCustomersWrapper } from '../wrapper/delivery-customers';
import { createMockContext } from './helpers/mock-supabase';

interface RecordedCall {
  table: string;
  method: string;
  args: any[];
}

const customerRowMinimal = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Ada Lovelace',
  order_count: 3,
  last_order_at: '2026-05-01T12:00:00Z',
};

const customerRowSearch = {
  ...customerRowMinimal,
  address: '12 Analytical Engine Way',
  notes: null,
};

describe('DeliveryCustomersWrapper — PII protections', () => {
  it('findAll selects only the minimal directory projection', async () => {
    const ctx = createMockContext({
      tenantId: 'tenant-1',
      responses: {
        delivery_customers: { data: [customerRowMinimal], error: null },
      },
    });
    const wrapper = createDeliveryCustomersWrapper(ctx);

    await wrapper.findAll();

    const selectCall = ctx.getCalls().find((c: RecordedCall) => c.method === 'select');
    expect(selectCall?.args[0]).toBe('id, name, order_count, last_order_at');
    expect(selectCall?.args[0]).not.toMatch(/phone/);
    expect(selectCall?.args[0]).not.toMatch(/address/);
  });

  it('findAllPaginated uses the minimal projection and ilike-by-name only', async () => {
    const ctx = createMockContext({
      tenantId: 'tenant-1',
      responses: {
        delivery_customers: { data: [customerRowMinimal], error: null, count: 1 },
      },
    });
    const wrapper = createDeliveryCustomersWrapper(ctx);

    await wrapper.findAllPaginated({ search: 'Ada' });

    const calls = ctx.getCalls() as RecordedCall[];
    const selectCall = calls.find((c) => c.method === 'select');
    expect(selectCall?.args[0]).toBe('id, name, order_count, last_order_at');

    // Phone search must never hit a base-table query — only the RPC.
    expect(calls.some((c) => c.method === 'or')).toBe(false);
    const ilike = calls.find((c) => c.method === 'ilike');
    expect(ilike?.args[0]).toBe('name');
  });

  it('search routes phone-shaped queries through the hashed-phone RPC', async () => {
    const ctx = createMockContext({
      tenantId: 'tenant-1',
      responses: {
        delivery_customers: { data: [], error: null },
      },
      rpcResponses: {
        find_delivery_customer_by_phone: { data: [customerRowSearch], error: null },
      },
    });
    const wrapper = createDeliveryCustomersWrapper(ctx);

    const results = await wrapper.search('+1 (555) 123-4567');

    const rpcCall = (ctx.getCalls() as RecordedCall[]).find((c) => c.table === '__rpc');
    expect(rpcCall?.method).toBe('find_delivery_customer_by_phone');
    expect(rpcCall?.args[0]).toEqual({ p_phone: '+1 (555) 123-4567' });
    expect(results).toHaveLength(1);
    expect(results[0]).not.toHaveProperty('phone');
  });

  it('search skips the RPC for purely-name queries', async () => {
    const ctx = createMockContext({
      tenantId: 'tenant-1',
      responses: {
        delivery_customers: { data: [customerRowSearch], error: null },
      },
    });
    const wrapper = createDeliveryCustomersWrapper(ctx);

    await wrapper.search('Ada');

    const rpcCall = (ctx.getCalls() as RecordedCall[]).find((c) => c.table === '__rpc');
    expect(rpcCall).toBeUndefined();
  });

  it('findByPhone calls the RPC and returns only safe fields', async () => {
    const ctx = createMockContext({
      tenantId: 'tenant-1',
      rpcResponses: {
        find_delivery_customer_by_phone: { data: [customerRowSearch], error: null },
      },
    });
    const wrapper = createDeliveryCustomersWrapper(ctx);

    const result = await wrapper.findByPhone('555-1234');

    const rpcCall = (ctx.getCalls() as RecordedCall[]).find((c) => c.table === '__rpc');
    expect(rpcCall?.method).toBe('find_delivery_customer_by_phone');
    expect(result).not.toHaveProperty('phone');
    expect(result?.name).toBe('Ada Lovelace');
  });

  it('findById reads from the decrypted view and maps decrypted_phone to phone', async () => {
    // Admin path — the view returned a plaintext phone.
    const ctx = createMockContext({
      tenantId: 'tenant-1',
      responses: {
        delivery_customers_decrypted: {
          data: { ...customerRowSearch, decrypted_phone: '+15551234567' },
          error: null,
        },
      },
    });
    const wrapper = createDeliveryCustomersWrapper(ctx);

    const result = (await wrapper.findById(customerRowSearch.id)) as Record<string, unknown>;

    const calls = ctx.getCalls() as RecordedCall[];
    const fromCall = calls.find((c) => c.method === 'select');
    expect(calls[0]?.table).toBe('delivery_customers_decrypted');
    expect(fromCall).toBeDefined();
    expect(result.phone).toBe('+15551234567');
    expect(result).not.toHaveProperty('decrypted_phone');
  });

  it('findById preserves NULL phone when the view withholds it from non-admin', async () => {
    // Waiter/kitchen path — view CASE returns NULL for decrypted_phone.
    const ctx = createMockContext({
      tenantId: 'tenant-1',
      responses: {
        delivery_customers_decrypted: {
          data: { ...customerRowSearch, decrypted_phone: null },
          error: null,
        },
      },
    });
    const wrapper = createDeliveryCustomersWrapper(ctx);

    const result = (await wrapper.findById(customerRowSearch.id)) as Record<string, unknown>;

    expect(result.phone).toBeNull();
    expect(result).not.toHaveProperty('decrypted_phone');
  });
});
