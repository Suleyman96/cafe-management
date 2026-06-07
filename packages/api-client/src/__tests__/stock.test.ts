import { ConflictError } from '@gustri/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStockItemsWrapper } from '../wrapper/stock';
import type { StockItemRow, StockMovementRow } from '../wrapper/types';
import {
  buildStockItem,
  buildStockItemInsert,
  buildStockItemUpdate,
  resetFactoryCounter,
} from './helpers/factories';
import { createMockContext } from './helpers/mock-supabase';

const validItem = buildStockItem({
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
});

describe('StockItemsWrapper', () => {
  beforeEach(() => {
    resetFactoryCounter();
  });

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
    const result: StockItemRow[] = await stock.findAll({ lowStockOnly: true });
    expect(result).toHaveLength(1);
    // length asserted above — index 0 is in-bounds
    expect(result[0]!.quantity).toBe(5);
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
    const result = await stock.create(
      buildStockItemInsert({
        name: 'Coffee Beans',
        category: 'Beverages',
        quantity: 50,
        unit: 'kg',
        cost_price: 12.5,
        minimum_stock_level: 10,
      }),
    );
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
    const result = await stock.update(
      validItem.id,
      buildStockItemUpdate({ name: 'Premium Coffee' }),
    );
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

  it('adjustStock is disabled and points callers at the API route', async () => {
    const ctx = createMockContext({ responses: {} });
    const stock = createStockItemsWrapper(ctx);
    await expect(stock.adjustStock(validItem.id, { type: 'in', quantity: 10 })).rejects.toThrow(
      /apiRoutes\.stock\.adjust/,
    );
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
    const result: StockMovementRow[] = await stock.getMovements(validItem.id);
    expect(result).toHaveLength(1);
    // length asserted above — index 0 is in-bounds
    expect(result[0]!.movement_type).toBe('in');
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

  it('findById throws when type guard rejects data (missing name, quantity, unit)', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: { id: '1' }, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    await expect(stock.findById('1')).rejects.toThrow('Invalid stock item data');
  });

  it('create throws when type guard rejects data', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: { id: '1' }, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    await expect(
      stock.create(
        buildStockItemInsert({
          name: 'Test',
          category: 'Test',
          quantity: 1,
          unit: 'kg',
          cost_price: 1,
          minimum_stock_level: 1,
        }),
      ),
    ).rejects.toThrow('Invalid stock item data');
  });

  it('update throws when type guard rejects data', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: { id: '1' }, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    await expect(stock.update('1', buildStockItemUpdate({ name: 'Updated' }))).rejects.toThrow(
      'Invalid stock item data',
    );
  });

  it('findAll returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: null, error: null },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    const result = await stock.findAll();
    expect(result).toEqual([]);
  });

  it('throws ConflictError for duplicate key violation (23505)', async () => {
    const ctx = createMockContext({
      responses: {
        stock_items: { data: null, error: { code: '23505', message: 'duplicate key' } },
      },
    });
    const stock = createStockItemsWrapper(ctx);
    await expect(
      stock.create(
        buildStockItemInsert({
          name: 'Duplicate',
          category: 'Test',
          quantity: 1,
          unit: 'kg',
          cost_price: 1,
          minimum_stock_level: 1,
        }),
      ),
    ).rejects.toThrow(ConflictError);
  });
});
