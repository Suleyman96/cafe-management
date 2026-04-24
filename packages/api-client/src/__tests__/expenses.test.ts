import { ConflictError } from '@gustri/core';
import { describe, expect, it } from 'vitest';
import { createExpenseCategoriesWrapper, createExpensesWrapper } from '../wrapper/expenses';
import { createMockContext } from './helpers/mock-supabase';

const validCategory = {
  id: '123e4567-e89b-12d3-a456-426614174010',
  name: 'Supplies',
  description: 'Kitchen supplies',
  icon: 'ShoppingCart',
  is_active: true,
  created_at: new Date().toISOString(),
};

const validExpense = {
  id: '123e4567-e89b-12d3-a456-426614174020',
  category_id: validCategory.id,
  amount: 150.5,
  description: 'Cleaning supplies',
  payment_method: 'cash' as const,
  expense_date: '2025-02-20',
  receipt_url: null,
  created_by: '123e4567-e89b-12d3-a456-426614174001',
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('ExpenseCategoriesWrapper', () => {
  it('findAll returns categories', async () => {
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: [validCategory], error: null },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    const result = await categories.findAll();
    expect(result).toEqual([validCategory]);
  });

  it('create inserts category', async () => {
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: validCategory, error: null },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    const result = await categories.create({
      name: 'Supplies',
      description: 'Kitchen supplies',
      icon: 'ShoppingCart',
      is_active: true,
    });
    expect(result).toEqual(validCategory);
    expect(ctx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies category', async () => {
    const updated = { ...validCategory, name: 'Office Supplies' };
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: updated, error: null },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    const result = await categories.update(validCategory.id, { name: 'Office Supplies' });
    expect(result.name).toBe('Office Supplies');
  });

  it('delete soft-deletes category', async () => {
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: null, error: null },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    await categories.delete(validCategory.id);
    expect(ctx.getCalls()[0].method).toBe('update');
  });

  it('throws on error', async () => {
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: null, error: { status: 500 } },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    await expect(categories.findAll()).rejects.toThrow();
  });

  it('create throws when type guard rejects data (missing is_active)', async () => {
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: { id: '1' }, error: null },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    await expect(
      categories.create({ name: 'Test', description: 'Test', icon: 'Box', is_active: true }),
    ).rejects.toThrow('Invalid expense category data');
  });

  it('update throws when type guard rejects data (missing name, is_active)', async () => {
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: { id: '1' }, error: null },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    await expect(categories.update('1', { name: 'Updated' })).rejects.toThrow(
      'Invalid expense category data',
    );
  });

  it('findAll returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: null, error: null },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    const result = await categories.findAll();
    expect(result).toEqual([]);
  });

  it('throws ConflictError for duplicate key violation (23505)', async () => {
    const ctx = createMockContext({
      responses: {
        expense_categories: { data: null, error: { code: '23505', message: 'duplicate key' } },
      },
    });
    const categories = createExpenseCategoriesWrapper(ctx);
    await expect(
      categories.create({ name: 'Duplicate', description: 'Test', icon: 'Box', is_active: true }),
    ).rejects.toThrow(ConflictError);
  });
});

describe('ExpensesWrapper', () => {
  it('findAll returns expenses', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: [validExpense], error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    const result = await expenses.findAll();
    expect(result).toEqual([validExpense]);
  });

  it('findAll with filters', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: [validExpense], error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    const result = await expenses.findAll({
      categoryId: validCategory.id,
      startDate: '2025-02-01',
      endDate: '2025-02-28',
      paymentMethod: 'cash',
    });
    expect(result).toEqual([validExpense]);
  });

  it('findById returns single expense', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: validExpense, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    const result = await expenses.findById(validExpense.id);
    expect(result).toEqual(validExpense);
  });

  it('create inserts expense', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: validExpense, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    const result = await expenses.create({
      amount: 150.5,
      description: 'Cleaning supplies',
      payment_method: 'cash',
      expense_date: '2025-02-20',
      category_id: validCategory.id,
      created_by: validExpense.created_by,
      receipt_url: null,
      notes: null,
    });
    expect(result).toEqual(validExpense);
    expect(ctx.getCalls()[0].method).toBe('insert');
  });

  it('update modifies expense', async () => {
    const updated = { ...validExpense, amount: 200 };
    const ctx = createMockContext({
      responses: {
        expenses: { data: updated, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    const result = await expenses.update(validExpense.id, { amount: 200 });
    expect(result.amount).toBe(200);
  });

  it('delete removes expense', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: null, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    await expenses.delete(validExpense.id);
    expect(ctx.getCalls()[0].method).toBe('delete');
  });

  it('getMonthlySummary returns summary', async () => {
    const expensesData = [
      { amount: 100, category: { id: 'cat1', name: 'Supplies' } },
      { amount: 200, category: { id: 'cat1', name: 'Supplies' } },
      { amount: 50, category: { id: 'cat2', name: 'Utilities' } },
    ];
    const ctx = createMockContext({
      responses: {
        expenses: { data: expensesData, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    const result = await expenses.getMonthlySummary(2025, 2);
    expect(result.total).toBe(350);
    expect(result.count).toBe(3);
    expect(result.byCategory).toHaveLength(2);
    expect(result.byCategory[0].name).toBe('Supplies');
    expect(result.byCategory[0].total).toBe(300);
  });

  it('throws on error', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: null, error: { status: 500 } },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    await expect(expenses.findAll()).rejects.toThrow();
  });

  it('findById throws when type guard rejects data (missing amount, description, payment_method)', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: { id: '1' }, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    await expect(expenses.findById('1')).rejects.toThrow('Invalid expense data');
  });

  it('create throws when type guard rejects data', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: { id: '1' }, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    await expect(
      expenses.create({
        amount: 100,
        description: 'Test',
        payment_method: 'cash',
        expense_date: '2025-02-20',
        category_id: 'cat1',
        created_by: 'staff1',
        receipt_url: null,
        notes: null,
      }),
    ).rejects.toThrow('Invalid expense data');
  });

  it('update throws when type guard rejects data', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: { id: '1' }, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    await expect(expenses.update('1', { amount: 200 })).rejects.toThrow('Invalid expense data');
  });

  it('findAll returns empty array when data is null', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: null, error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    const result = await expenses.findAll();
    expect(result).toEqual([]);
  });

  it('throws ConflictError for duplicate key violation (23505)', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: null, error: { code: '23505', message: 'duplicate key' } },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    await expect(
      expenses.create({
        amount: 100,
        description: 'Test',
        payment_method: 'cash',
        expense_date: '2025-02-20',
        category_id: 'cat1',
        created_by: 'staff1',
        receipt_url: null,
        notes: null,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('getMonthlySummary with empty data returns zero totals', async () => {
    const ctx = createMockContext({
      responses: {
        expenses: { data: [], error: null },
      },
    });
    const expenses = createExpensesWrapper(ctx);
    const result = await expenses.getMonthlySummary(2025, 6);
    expect(result).toEqual({ total: 0, count: 0, byCategory: [] });
  });
});
