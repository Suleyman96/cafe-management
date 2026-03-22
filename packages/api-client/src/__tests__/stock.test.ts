import { describe, expect, it } from 'vitest';
import { createStockItemsWrapper } from '../wrapper/stock';
import { createMockContext } from './helpers/mock-supabase';

const validItem = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Coffee Beans',
  description: 'Arabica blend',
  category: 'Beverages',
  quantity: 50,
  unit: 'kg',
  cost_price: 12.5,
  minimum_stock_level: 10,
  supplier_name: 'Bean Co',
  notes: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('StockItemsWrapper', () => {
  it('findAll returns stock items', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: [validItem], error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = await stock.findAll();
    expect(result).toEqual([validItem]);
  });

  it('findAll filters by low stock only', async () => {
    const lowItem = { ...validItem, quantity: 5 };
    const goodItem = { ...validItem, id: '2', quantity: 50 };
    const ctx = createMockContext({
      responses: {
        stock_items: { data: [lowItem, goodItem], error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = (await stock.findAll({ lowStockOnly: true })) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it('findById returns single item', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: validItem, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = await stock.findById(validItem.id);
    expect(result).toEqual(validItem);
  });

  it('create inserts stock item', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: validItem, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = await stock.create({
      name: 'Coffee Beans',
      category: 'Beverages',
      quantity: 50,
      unit: 'kg',
      cost_price: 12.5,
      minimum_stock_level: 10,
    } as any);
    expect(result).toEqual(validItem);
    expect(ctx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies stock item', async () => {
    const updated = { ...validItem, name: 'Premium Coffee' };
    const ctx = createMockContext({
      responses: {
        stock_items: { data: updated, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = await stock.update(validItem.id, { name: 'Premium Coffee' } as any);
    expect(result.name).toBe('Premium Coffee');
  });

  it('delete soft-deletes item', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: null, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    await stock.delete(validItem.id);
    expect(ctx.getCalls()[0].method).toBe('update');
  });

  it('adjustStock adds stock (in)', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: { ...validItem, quantity: 60 }, error: null },
        stock_movements: { data: null, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = await stock.adjustStock(validItem.id, {
      type: 'in',
      quantity: 10,
      reason: 'New shipment',
    });
    expect(result.quantity).toBe(60);
  });

  it('adjustStock removes stock (out)', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: { ...validItem, quantity: 40 }, error: null },
        stock_movements: { data: null, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = await stock.adjustStock(validItem.id, {
      type: 'out',
      quantity: 10,
      reason: 'Used in production',
    });
    expect(result.quantity).toBe(40);
  });

  it('getMovements returns movement history', async () => {
    const movement = {
      id: 'mov-1',
      stock_item_id: validItem.id,
      movement_type: 'in',
      quantity_change: 10,
      quantity_after: 60,
      reason: 'New shipment',
      performed_by: null,
      created_at: new Date().toISOString(),
    };
    const ctx = createMockContext({
      responses: {
        stock_movements: { data: [movement], error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = (await stock.getMovements(validItem.id)) as any[];
    expect(result).toHaveLength(1);
    expect(result[0].movement_type).toBe('in');
  });

  it('getLowStockCount returns count of low items', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: {
          data: [
            { id: '1', quantity: 5, minimum_stock_level: 10 },
            { id: '2', quantity: 50, minimum_stock_level: 10 },
            { id: '3', quantity: 3, minimum_stock_level: 5 },
          ],
          error: null,
        },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = await stock.getLowStockCount();
    expect(result).toBe(2);
  });

  it('throws on supabase error', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: null, error: { status: 500 } },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    await expect(stock.findAll()).rejects.toThrow();
  });
});
