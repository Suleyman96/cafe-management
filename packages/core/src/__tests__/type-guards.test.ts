import { describe, expect, it } from 'vitest';
import {
  assertType,
  isAdmin,
  isCategory,
  isCustomerFeedback,
  isExpense,
  isExpenseCategory,
  isKitchen,
  isMenuItem,
  isOccupiedTable,
  isOrder,
  isOrderArray,
  isOrderItem,
  isOrderPayment,
  isStaff,
  isStockItem,
  isStockMovement,
  isTable,
  isTableTransfer,
  isWaiter,
  isWaiterCall,
  safeGet,
} from '../type-guards';

describe('isOrder', () => {
  it('returns true for valid order object', () => {
    expect(isOrder({ id: '1', status: 'new', created_at: '2024-01-01' })).toBe(true);
  });

  it('returns false for missing fields', () => {
    expect(isOrder({ id: '1' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isOrder(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isOrder('not an order')).toBe(false);
  });
});

describe('isTable', () => {
  it('returns true for valid table', () => {
    expect(isTable({ id: '1', table_number: 'T01', status: 'free' })).toBe(true);
  });

  it('returns false for missing table_number', () => {
    expect(isTable({ id: '1', status: 'free' })).toBe(false);
  });
});

describe('isOccupiedTable', () => {
  it('returns true for occupied table', () => {
    expect(isOccupiedTable({ status: 'occupied' } as any)).toBe(true);
  });

  it('returns false for free table', () => {
    expect(isOccupiedTable({ status: 'free' } as any)).toBe(false);
  });
});

describe('isStaff', () => {
  it('returns true for valid staff', () => {
    expect(isStaff({ id: '1', email: 'a@b.com', role: 'waiter' })).toBe(true);
  });

  it('returns false for missing role', () => {
    expect(isStaff({ id: '1', email: 'a@b.com' })).toBe(false);
  });
});

describe('role checks', () => {
  it('isWaiter returns true for waiter role', () => {
    expect(isWaiter({ role: 'waiter' } as any)).toBe(true);
    expect(isWaiter({ role: 'admin' } as any)).toBe(false);
  });

  it('isAdmin returns true for admin role', () => {
    expect(isAdmin({ role: 'admin' } as any)).toBe(true);
    expect(isAdmin({ role: 'waiter' } as any)).toBe(false);
  });

  it('isKitchen returns true for kitchen role', () => {
    expect(isKitchen({ role: 'kitchen' } as any)).toBe(true);
    expect(isKitchen({ role: 'waiter' } as any)).toBe(false);
  });
});

describe('isMenuItem', () => {
  it('returns true for valid menu item', () => {
    expect(isMenuItem({ id: '1', name: 'Pizza', price: 10 })).toBe(true);
  });

  it('returns false for missing price', () => {
    expect(isMenuItem({ id: '1', name: 'Pizza' })).toBe(false);
  });
});

describe('isCategory', () => {
  it('returns true for valid category', () => {
    expect(isCategory({ id: '1', name: 'Main Dishes' })).toBe(true);
  });

  it('returns false for missing name', () => {
    expect(isCategory({ id: '1' })).toBe(false);
  });
});

describe('isWaiterCall', () => {
  it('returns true for valid waiter call', () => {
    expect(isWaiterCall({ id: '1', table_id: '2', reason: 'Need help', status: 'pending' })).toBe(
      true,
    );
  });

  it('returns false for missing reason', () => {
    expect(isWaiterCall({ id: '1', table_id: '2', status: 'pending' })).toBe(false);
  });
});

describe('isCustomerFeedback', () => {
  it('returns true for valid feedback', () => {
    expect(
      isCustomerFeedback({
        id: '1',
        feedback_type: 'suggestion',
        message: 'Great!',
        status: 'pending',
      }),
    ).toBe(true);
  });

  it('returns false for missing message', () => {
    expect(isCustomerFeedback({ id: '1', feedback_type: 'suggestion', status: 'pending' })).toBe(
      false,
    );
  });
});

describe('isOrderPayment', () => {
  it('returns true for valid payment', () => {
    expect(
      isOrderPayment({
        id: '1',
        order_id: '2',
        amount: 100,
        payment_method: 'cash',
      }),
    ).toBe(true);
  });

  it('returns false for missing amount', () => {
    expect(isOrderPayment({ id: '1', order_id: '2', payment_method: 'cash' })).toBe(false);
  });
});

describe('isTableTransfer', () => {
  it('returns true for valid transfer', () => {
    expect(
      isTableTransfer({
        id: '1',
        order_id: '2',
        from_table_id: '3',
        to_table_id: '4',
      }),
    ).toBe(true);
  });

  it('returns false for missing to_table_id', () => {
    expect(isTableTransfer({ id: '1', order_id: '2', from_table_id: '3' })).toBe(false);
  });
});

describe('isOrderItem', () => {
  it('returns true for valid order item', () => {
    expect(
      isOrderItem({
        id: '1',
        order_id: '2',
        menu_item_id: '3',
        quantity: 1,
        item_price: 10,
      }),
    ).toBe(true);
  });

  it('returns false for missing quantity', () => {
    expect(isOrderItem({ id: '1', order_id: '2', menu_item_id: '3', item_price: 10 })).toBe(false);
  });
});

describe('isOrderArray', () => {
  it('returns true for valid order array', () => {
    expect(
      isOrderArray([
        { id: '1', status: 'new', created_at: '2024-01-01' },
        { id: '2', status: 'ready', created_at: '2024-01-01' },
      ]),
    ).toBe(true);
  });

  it('returns false for mixed array', () => {
    expect(
      isOrderArray([{ id: '1', status: 'new', created_at: '2024-01-01' }, 'not an order']),
    ).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(isOrderArray([])).toBe(true);
  });
});

describe('safeGet', () => {
  it('returns value for valid access', () => {
    expect(safeGet({ name: 'test' }, 'name')).toBe('test');
  });

  it('returns null for null object', () => {
    expect(safeGet(null as { name: string } | null, 'name')).toBeNull();
  });

  it('returns default for missing key', () => {
    expect(safeGet({} as any, 'missing' as any, 'default')).toBe('default');
  });
});

describe('assertType', () => {
  it('returns value when guard passes', () => {
    const value = { id: '1', status: 'new', created_at: '2024-01-01' };
    expect(assertType(value, isOrder, 'Not an order')).toBe(value);
  });

  it('throws when guard fails', () => {
    expect(() => assertType('not an order', isOrder, 'Not an order')).toThrow('Not an order');
  });
});

describe('isStockItem', () => {
  it('returns true for valid stock item', () => {
    expect(isStockItem({ id: '1', name: 'Coffee', quantity: 10, unit: 'kg' })).toBe(true);
  });

  it('returns false for missing name', () => {
    expect(isStockItem({ id: '1', quantity: 10, unit: 'kg' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isStockItem(null)).toBe(false);
  });
});

describe('isStockMovement', () => {
  it('returns true for valid movement', () => {
    expect(
      isStockMovement({
        id: '1',
        stock_item_id: '2',
        movement_type: 'in',
        quantity_change: 10,
      }),
    ).toBe(true);
  });

  it('returns false for missing fields', () => {
    expect(isStockMovement({ id: '1' })).toBe(false);
  });
});

describe('isExpenseCategory', () => {
  it('returns true for valid category', () => {
    expect(isExpenseCategory({ id: '1', name: 'Supplies', is_active: true })).toBe(true);
  });

  it('returns false for missing is_active', () => {
    expect(isExpenseCategory({ id: '1', name: 'Supplies' })).toBe(false);
  });
});

describe('isExpense', () => {
  it('returns true for valid expense', () => {
    expect(
      isExpense({
        id: '1',
        amount: 100,
        description: 'Test',
        payment_method: 'cash',
      }),
    ).toBe(true);
  });

  it('returns false for missing amount', () => {
    expect(isExpense({ id: '1', description: 'Test', payment_method: 'cash' })).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isExpense('not an expense')).toBe(false);
  });
});
