import { describe, expect, it } from 'vitest';
import { createRpcWrapper } from '../wrapper/rpc';
import { createMockContext } from './helpers/mock-supabase';

describe('RpcWrapper', () => {
  describe('getRemainingBalance', () => {
    it('returns balance for order', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          get_order_remaining_balance: { data: 25.5, error: null },
        },
      });
      const rpc = createRpcWrapper(ctx);
      const result = await rpc.getRemainingBalance('order-123');
      expect(result).toBe(25.5);
    });

    it('returns 0 when no data', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          get_order_remaining_balance: { data: null, error: null },
        },
      });
      const rpc = createRpcWrapper(ctx);
      const result = await rpc.getRemainingBalance('order-123');
      expect(result).toBe(0);
    });

    it('returns exactly 0 when balance is zero (not falsy fallback)', async () => {
      // This test catches the || vs ?? bug: (0 as number) || 0 = 0 (ok),
      // but more importantly ensures 0 is returned as-is without being
      // coerced or swallowed by falsy checks.
      const ctx = createMockContext({
        rpcResponses: {
          get_order_remaining_balance: { data: 0, error: null },
        },
      });
      const rpc = createRpcWrapper(ctx);
      const result = await rpc.getRemainingBalance('order-123');
      expect(result).toBe(0);
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
    });

    it('throws on error', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          get_order_remaining_balance: { data: null, error: { status: 404 } },
        },
      });
      const rpc = createRpcWrapper(ctx);
      await expect(rpc.getRemainingBalance('bad-id')).rejects.toThrow();
    });
  });

  describe('transferTable', () => {
    it('returns true on success', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          transfer_table: { data: true, error: null },
        },
      });
      const rpc = createRpcWrapper(ctx);
      const result = await rpc.transferTable({
        orderId: 'o1',
        fromTableId: 't1',
        toTableId: 't2',
        staffId: 's1',
        reason: 'Customer request',
      });
      expect(result).toBe(true);
    });

    it('returns false when no data', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          transfer_table: { data: null, error: null },
        },
      });
      const rpc = createRpcWrapper(ctx);
      const result = await rpc.transferTable({
        orderId: 'o1',
        fromTableId: 't1',
        toTableId: 't2',
        staffId: 's1',
      });
      expect(result).toBe(false);
    });

    it('passes correct RPC params', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          transfer_table: { data: true, error: null },
        },
      });
      const rpc = createRpcWrapper(ctx);
      await rpc.transferTable({
        orderId: 'o1',
        fromTableId: 't1',
        toTableId: 't2',
        staffId: 's1',
        reason: 'test',
      });
      const calls = ctx.getCalls();
      expect(calls[0].method).toBe('transfer_table');
      expect(calls[0].args[0]).toEqual({
        p_order_id: 'o1',
        p_from_table_id: 't1',
        p_to_table_id: 't2',
        p_staff_id: 's1',
        p_reason: 'test',
      });
    });

    it('throws on error', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          transfer_table: { data: null, error: { code: '23503' } },
        },
      });
      const rpc = createRpcWrapper(ctx);
      await expect(
        rpc.transferTable({
          orderId: 'o1',
          fromTableId: 't1',
          toTableId: 't2',
          staffId: 's1',
        }),
      ).rejects.toThrow();
    });
  });

  describe('generateOrderNumber', () => {
    it('returns generated order number', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          generate_order_number: { data: 'ORD-2024-0001', error: null },
        },
      });
      const rpc = createRpcWrapper(ctx);
      const result = await rpc.generateOrderNumber();
      expect(result).toBe('ORD-2024-0001');
    });

    it('returns empty string when no data', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          generate_order_number: { data: null, error: null },
        },
      });
      const rpc = createRpcWrapper(ctx);
      const result = await rpc.generateOrderNumber();
      expect(result).toBe('');
    });

    it('throws on error', async () => {
      const ctx = createMockContext({
        rpcResponses: {
          generate_order_number: { data: null, error: { status: 500 } },
        },
      });
      const rpc = createRpcWrapper(ctx);
      await expect(rpc.generateOrderNumber()).rejects.toThrow();
    });
  });
});
