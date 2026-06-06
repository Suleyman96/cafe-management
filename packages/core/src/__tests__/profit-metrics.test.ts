import { describe, expect, it } from 'vitest';
import {
  calculateNetProfit,
  calculateProfitMargin,
  calculateProfitMetrics,
  calculateTotalExpenses,
  groupExpensesByCategory,
} from '../profit-metrics';

describe('calculateTotalExpenses', () => {
  it('sums expense amounts', () => {
    const expenses = [{ amount: 100 }, { amount: 200 }, { amount: 50 }];
    expect(calculateTotalExpenses(expenses)).toBe(350);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotalExpenses([])).toBe(0);
  });

  it('handles string amounts (from DECIMAL columns)', () => {
    const expenses = [{ amount: '100.50' as any }, { amount: '200' as any }];
    expect(calculateTotalExpenses(expenses)).toBe(300.5);
  });

  it('handles null/undefined amounts gracefully', () => {
    const expenses = [{ amount: null as any }, { amount: undefined as any }, { amount: 50 }];
    expect(calculateTotalExpenses(expenses)).toBe(50);
  });
});

describe('calculateNetProfit', () => {
  it('returns positive profit when revenue exceeds expenses', () => {
    expect(calculateNetProfit(1000, 600)).toBe(400);
  });

  it('returns negative when expenses exceed revenue', () => {
    expect(calculateNetProfit(500, 800)).toBe(-300);
  });

  it('returns zero when revenue equals expenses', () => {
    expect(calculateNetProfit(500, 500)).toBe(0);
  });

  it('handles zero revenue and zero expenses', () => {
    expect(calculateNetProfit(0, 0)).toBe(0);
  });
});

describe('calculateProfitMargin', () => {
  it('calculates correct margin percentage', () => {
    expect(calculateProfitMargin(1000, 400)).toBe(40);
  });

  it('returns 0 when revenue is 0', () => {
    expect(calculateProfitMargin(0, 0)).toBe(0);
  });

  it('returns negative margin for losses', () => {
    expect(calculateProfitMargin(1000, -200)).toBe(-20);
  });

  it('returns 100% margin when no expenses', () => {
    expect(calculateProfitMargin(500, 500)).toBe(100);
  });
});

describe('groupExpensesByCategory', () => {
  it('groups expenses by category', () => {
    const expenses = [
      { amount: 100, category: { id: '1', name: 'Rent' } },
      { amount: 200, category: { id: '2', name: 'Supplies' } },
      { amount: 150, category: { id: '1', name: 'Rent' } },
    ];

    const result = groupExpensesByCategory(expenses);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: 'Rent', total: 250, count: 2 });
    expect(result[1]).toEqual({ name: 'Supplies', total: 200, count: 1 });
  });

  it('sorts by total descending', () => {
    const expenses = [
      { amount: 50, category: { id: '1', name: 'Small' } },
      { amount: 500, category: { id: '2', name: 'Large' } },
      { amount: 200, category: { id: '3', name: 'Medium' } },
    ];

    const result = groupExpensesByCategory(expenses);
    expect(result[0].name).toBe('Large');
    expect(result[1].name).toBe('Medium');
    expect(result[2].name).toBe('Small');
  });

  it('emits a null name for null category (UI localizes it, not the headless layer)', () => {
    const expenses = [
      { amount: 100, category: null },
      { amount: 200, category: null },
    ];

    const result = groupExpensesByCategory(expenses);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: null, total: 300, count: 2 });
  });

  it('emits a null name for a missing category field', () => {
    const expenses = [{ amount: 100 }, { amount: 200 }];

    const result = groupExpensesByCategory(expenses);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBeNull();
    expect(result[0].total).toBe(300);
  });

  it('returns empty array for no expenses', () => {
    expect(groupExpensesByCategory([])).toEqual([]);
  });
});

describe('calculateProfitMetrics', () => {
  it('calculates all metrics correctly', () => {
    const expenses = [
      { amount: 300, category: { id: '1', name: 'Rent' } },
      { amount: 200, category: { id: '2', name: 'Supplies' } },
    ];

    const result = calculateProfitMetrics(1000, expenses);

    expect(result.totalExpenses).toBe(500);
    expect(result.netProfit).toBe(500);
    expect(result.profitMargin).toBe(50);
    expect(result.byCategory).toHaveLength(2);
    expect(result.byCategory[0].name).toBe('Rent');
    expect(result.byCategory[1].name).toBe('Supplies');
  });

  it('handles zero revenue with expenses', () => {
    const expenses = [{ amount: 100 }];
    const result = calculateProfitMetrics(0, expenses);

    expect(result.totalExpenses).toBe(100);
    expect(result.netProfit).toBe(-100);
    expect(result.profitMargin).toBe(0);
  });

  it('handles revenue with no expenses', () => {
    const result = calculateProfitMetrics(1000, []);

    expect(result.totalExpenses).toBe(0);
    expect(result.netProfit).toBe(1000);
    expect(result.profitMargin).toBe(100);
    expect(result.byCategory).toEqual([]);
  });

  it('handles both zero', () => {
    const result = calculateProfitMetrics(0, []);

    expect(result.totalExpenses).toBe(0);
    expect(result.netProfit).toBe(0);
    expect(result.profitMargin).toBe(0);
    expect(result.byCategory).toEqual([]);
  });
});
