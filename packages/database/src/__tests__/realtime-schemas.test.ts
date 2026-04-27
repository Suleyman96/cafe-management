import { describe, expect, it } from 'vitest';
import {
  OrdersRealtimeInsertSchema,
  OrdersRealtimeUpdateSchema,
  WaiterCallsRealtimeInsertSchema,
  WaiterCallsRealtimeUpdateSchema,
} from '../schemas/realtime';

const validUuid = '11111111-1111-4111-8111-111111111111';
const otherUuid = '22222222-2222-4222-8222-222222222222';

describe('OrdersRealtimeInsertSchema', () => {
  it('parses a well-formed INSERT payload', () => {
    const result = OrdersRealtimeInsertSchema.safeParse({
      id: validUuid,
      table_id: otherUuid,
      order_number: 'A-1024',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null table_id (takeout/delivery orders)', () => {
    const result = OrdersRealtimeInsertSchema.safeParse({
      id: validUuid,
      table_id: null,
      order_number: 'A-1024',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null order_number (legacy rows)', () => {
    const result = OrdersRealtimeInsertSchema.safeParse({
      id: validUuid,
      table_id: otherUuid,
      order_number: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects payload missing id', () => {
    const result = OrdersRealtimeInsertSchema.safeParse({
      table_id: otherUuid,
      order_number: 'A-1024',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid id', () => {
    const result = OrdersRealtimeInsertSchema.safeParse({
      id: 'not-a-uuid',
      table_id: otherUuid,
      order_number: 'A-1024',
    });
    expect(result.success).toBe(false);
  });

  it('rejects wrong type for table_id', () => {
    const result = OrdersRealtimeInsertSchema.safeParse({
      id: validUuid,
      table_id: 42,
      order_number: 'A-1024',
    });
    expect(result.success).toBe(false);
  });
});

describe('WaiterCallsRealtimeInsertSchema', () => {
  it('parses a well-formed INSERT payload', () => {
    const result = WaiterCallsRealtimeInsertSchema.safeParse({
      id: validUuid,
      table_id: otherUuid,
      call_type: 'assistance',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null call_type (handler falls back to default)', () => {
    const result = WaiterCallsRealtimeInsertSchema.safeParse({
      id: validUuid,
      table_id: otherUuid,
      call_type: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown call_type values', () => {
    const result = WaiterCallsRealtimeInsertSchema.safeParse({
      id: validUuid,
      table_id: otherUuid,
      call_type: 'not-a-real-type',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing table_id (waiter calls always have a table)', () => {
    const result = WaiterCallsRealtimeInsertSchema.safeParse({
      id: validUuid,
      call_type: 'assistance',
    });
    expect(result.success).toBe(false);
  });

  it('rejects null table_id', () => {
    const result = WaiterCallsRealtimeInsertSchema.safeParse({
      id: validUuid,
      table_id: null,
      call_type: 'assistance',
    });
    expect(result.success).toBe(false);
  });
});

describe('OrdersRealtimeUpdateSchema', () => {
  it('parses a well-formed UPDATE payload', () => {
    const result = OrdersRealtimeUpdateSchema.safeParse({
      id: validUuid,
      status: 'preparing',
      table_id: otherUuid,
      updated_at: '2026-04-27T12:34:56.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null status (transient state)', () => {
    const result = OrdersRealtimeUpdateSchema.safeParse({
      id: validUuid,
      status: null,
      table_id: otherUuid,
      updated_at: '2026-04-27T12:34:56.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null updated_at and table_id', () => {
    const result = OrdersRealtimeUpdateSchema.safeParse({
      id: validUuid,
      status: 'new',
      table_id: null,
      updated_at: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown status values', () => {
    const result = OrdersRealtimeUpdateSchema.safeParse({
      id: validUuid,
      status: 'invalid_status',
      table_id: otherUuid,
      updated_at: '2026-04-27T12:34:56.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed updated_at', () => {
    const result = OrdersRealtimeUpdateSchema.safeParse({
      id: validUuid,
      status: 'new',
      table_id: otherUuid,
      updated_at: 'not-a-timestamp',
    });
    expect(result.success).toBe(false);
  });
});

describe('WaiterCallsRealtimeUpdateSchema', () => {
  it('parses a well-formed UPDATE payload', () => {
    const result = WaiterCallsRealtimeUpdateSchema.safeParse({
      id: validUuid,
      status: 'resolved',
      resolved_at: '2026-04-27T12:34:56.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null resolved_at (still pending)', () => {
    const result = WaiterCallsRealtimeUpdateSchema.safeParse({
      id: validUuid,
      status: 'acknowledged',
      resolved_at: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown status values', () => {
    const result = WaiterCallsRealtimeUpdateSchema.safeParse({
      id: validUuid,
      status: 'on_fire',
      resolved_at: null,
    });
    expect(result.success).toBe(false);
  });
});
