import { describe, expect, it } from 'vitest';
import { createWasteWrapper } from '../wrapper/waste';
import { createMockContext } from './helpers/mock-supabase';

const validWasteLog = {
  id: '123e4567-e89b-12d3-a456-426614174030',
  item_name: 'Tomatoes',
  category: 'Vegetables',
  quantity: 2.5,
  unit: 'kg',
  cost_per_unit: 3.0,
  total_cost: 7.5,
  reason: 'expired',
  stock_item_id: '123e4567-e89b-12d3-a456-426614174031',
  notes: 'Found in back of fridge',
  logged_by: '123e4567-e89b-12d3-a456-426614174001',
  waste_date: '2025-02-20',
  created_at: new Date().toISOString(),
};

describe('WasteWrapper', () => {
  it('findAll returns waste logs', async () => {
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: [validWasteLog], error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    const result = await waste.findAll();
    expect(result).toEqual([validWasteLog]);
  });

  it('findAll with filters', async () => {
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: [validWasteLog], error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    const result = await waste.findAll({
      startDate: '2025-02-01',
      endDate: '2025-02-28',
      reason: 'expired',
      stockItemId: validWasteLog.stock_item_id!,
    });
    expect(result).toEqual([validWasteLog]);
  });

  it('findById returns single waste log', async () => {
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: validWasteLog, error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    const result = await waste.findById(validWasteLog.id);
    expect(result).toEqual(validWasteLog);
  });

  it('create inserts waste log', async () => {
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: validWasteLog, error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    const result = await waste.create({
      item_name: 'Tomatoes',
      category: 'Vegetables',
      quantity: 2.5,
      unit: 'kg',
      cost_per_unit: 3.0,
      total_cost: 7.5,
      reason: 'expired',
      stock_item_id: validWasteLog.stock_item_id,
      waste_date: '2025-02-20',
      notes: 'Found in back of fridge',
      logged_by: validWasteLog.logged_by,
    });
    expect(result).toEqual(validWasteLog);
    expect(ctx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies waste log', async () => {
    const updated = { ...validWasteLog, quantity: 5.0, total_cost: 15.0 };
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: updated, error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    const result = await waste.update(validWasteLog.id, { quantity: 5.0, total_cost: 15.0 });
    expect(result.quantity).toBe(5.0);
    expect(result.total_cost).toBe(15.0);
  });

  it('delete removes waste log', async () => {
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: null, error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    await waste.delete(validWasteLog.id);
    expect(ctx.getCalls()[0].method).toBe('delete');
  });

  it('getMonthlySummary returns correct totals', async () => {
    const logsData = [
      { total_cost: 7.5, reason: 'expired', category: 'Vegetables' },
      { total_cost: 12.0, reason: 'expired', category: 'Vegetables' },
      { total_cost: 5.0, reason: 'spoiled', category: 'Dairy' },
    ];
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: logsData, error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    const result = await waste.getMonthlySummary(2025, 2);
    expect(result.totalCost).toBe(24.5);
    expect(result.count).toBe(3);
    expect(result.byReason).toHaveLength(2);
    // length asserted above — index 0 is in-bounds
    expect(result.byReason[0]!.reason).toBe('expired');
    expect(result.byReason[0]!.total).toBe(19.5);
    expect(result.byCategory).toHaveLength(2);
    // length asserted above — index 0 is in-bounds
    expect(result.byCategory[0]!.category).toBe('Vegetables');
  });

  it('getDailySummary returns daily totals', async () => {
    const logsData = [{ total_cost: 7.5 }, { total_cost: 5.0 }];
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: logsData, error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    const result = await waste.getDailySummary('2025-02-20');
    expect(result.totalCost).toBe(12.5);
    expect(result.count).toBe(2);
  });

  it('getTopWastedItems returns items', async () => {
    const items = [
      { item_name: 'Tomatoes', total_cost: 15.0, quantity: 5, unit: 'kg' },
      { item_name: 'Bread', total_cost: 8.0, quantity: 4, unit: 'pieces' },
    ];
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: items, error: null },
      },
    });
    const waste = createWasteWrapper(ctx);
    const result = await waste.getTopWastedItems(5);
    expect(result).toHaveLength(2);
    // length asserted above — index 0 is in-bounds
    expect(result[0]!.item_name).toBe('Tomatoes');
  });

  it('throws on error', async () => {
    const ctx = createMockContext({
      responses: {
        waste_logs: { data: null, error: { status: 500 } },
      },
    });
    const waste = createWasteWrapper(ctx);
    await expect(waste.findAll()).rejects.toThrow();
  });
});
