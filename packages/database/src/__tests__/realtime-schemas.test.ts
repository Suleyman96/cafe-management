import { describe, expect, it } from 'vitest';
import { OrdersRealtimeInsertSchema, WaiterCallsRealtimeInsertSchema } from '../schemas/realtime';

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
