import { QUERY_KEYS } from '@gustri/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateDeliveryCustomer,
  useDeleteDeliveryCustomer,
  useIncrementDeliveryCustomerOrderCount,
  useUpdateDeliveryCustomer,
} from '../../mutations/use-delivery-customer-mutations';
import {
  useCreateExpense,
  useCreateExpenseCategory,
  useDeleteExpense,
  useDeleteExpenseCategory,
  useUpdateExpense,
  useUpdateExpenseCategory,
} from '../../mutations/use-expense-mutations';
import { useMarkFeedbackRead } from '../../mutations/use-feedback-mutations';
import { useUpdateCafeSettings } from '../../mutations/use-settings-mutations';
import {
  useAcknowledgeWaiterCall,
  useResolveWaiterCall,
} from '../../mutations/use-waiter-call-mutations';
import {
  useCreateWasteLog,
  useDeleteWasteLog,
  useUpdateWasteLog,
} from '../../mutations/use-waste-mutations';
import { renderHookWithProviders } from '../helpers/test-utils';

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

// ─── Settings ───────────────────────────────────────────────────────────────

describe('useUpdateCafeSettings', () => {
  it('calls db.settings.update with the updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateCafeSettings());
    const updates = { tax_enabled: true, tax_percentage: 18 } as any;
    await result.current.mutateAsync(updates);
    expect(mockDb.settings.update).toHaveBeenCalledWith(updates);
  });

  it('invalidates cafe_settings on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateCafeSettings());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.CAFE_SETTINGS]);
  });
});

// ─── Feedback ───────────────────────────────────────────────────────────────

describe('useMarkFeedbackRead', () => {
  it('calls markRead with id and staffId', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useMarkFeedbackRead());
    await result.current.mutateAsync({ id: 'f1', staffId: 's1' });
    expect(mockDb.feedback.markRead).toHaveBeenCalledWith('f1', 's1');
  });

  it('invalidates feedback on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useMarkFeedbackRead());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 'f1', staffId: 's1' });
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.FEEDBACK]);
  });
});

// ─── Waiter Calls ───────────────────────────────────────────────────────────

describe('useAcknowledgeWaiterCall', () => {
  it('calls acknowledge with id + staffId', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useAcknowledgeWaiterCall());
    await result.current.mutateAsync({ id: 'wc1', staffId: 's1' });
    expect(mockDb.waiterCalls.acknowledge).toHaveBeenCalledWith('wc1', 's1');
  });

  it('invalidates waiter calls on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAcknowledgeWaiterCall());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 'wc1', staffId: 's1' });
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.WAITER_CALLS]);
  });
});

describe('useResolveWaiterCall', () => {
  it('forwards id + optional notes', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useResolveWaiterCall());
    await result.current.mutateAsync({ id: 'wc1', notes: 'done' });
    expect(mockDb.waiterCalls.resolve).toHaveBeenCalledWith('wc1', 'done');
  });

  it('handles missing notes', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useResolveWaiterCall());
    await result.current.mutateAsync({ id: 'wc1' });
    expect(mockDb.waiterCalls.resolve).toHaveBeenCalledWith('wc1', undefined);
  });
});

// ─── Expenses ───────────────────────────────────────────────────────────────

describe('expense mutations', () => {
  it('useCreateExpense forwards data', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateExpense());
    const data = { amount: 50 } as any;
    await result.current.mutateAsync(data);
    expect(mockDb.expenses.create).toHaveBeenCalledWith(data);
  });

  it('useCreateExpense invalidates expenses + categories', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateExpense());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual([QUERY_KEYS.EXPENSES]);
    expect(keys).toContainEqual([QUERY_KEYS.EXPENSE_CATEGORIES]);
  });

  it('useUpdateExpense forwards id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateExpense());
    await result.current.mutateAsync({ id: 'e1', updates: { amount: 60 } });
    expect(mockDb.expenses.update).toHaveBeenCalledWith('e1', { amount: 60 });
  });

  it('useDeleteExpense forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteExpense());
    await result.current.mutateAsync('e1');
    expect(mockDb.expenses.delete).toHaveBeenCalledWith('e1');
  });

  it('useCreateExpenseCategory forwards data', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateExpenseCategory());
    await result.current.mutateAsync({ name: 'utilities' } as any);
    expect(mockDb.expenseCategories.create).toHaveBeenCalledWith({ name: 'utilities' });
  });

  it('useUpdateExpenseCategory forwards id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateExpenseCategory());
    await result.current.mutateAsync({ id: 'ec1', updates: { name: 'new' } });
    expect(mockDb.expenseCategories.update).toHaveBeenCalledWith('ec1', { name: 'new' });
  });

  it('useDeleteExpenseCategory forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteExpenseCategory());
    await result.current.mutateAsync('ec1');
    expect(mockDb.expenseCategories.delete).toHaveBeenCalledWith('ec1');
  });
});

// ─── Waste ──────────────────────────────────────────────────────────────────

describe('waste mutations', () => {
  it('useCreateWasteLog forwards data', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateWasteLog());
    await result.current.mutateAsync({ quantity: 1, reason: 'expired' } as any);
    expect(mockDb.waste.create).toHaveBeenCalledWith({ quantity: 1, reason: 'expired' });
  });

  it('useCreateWasteLog invalidates waste keys', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateWasteLog());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual([QUERY_KEYS.WASTE_LOGS]);
    expect(keys).toContainEqual([QUERY_KEYS.WASTE_SUMMARY]);
  });

  it('useUpdateWasteLog forwards id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateWasteLog());
    await result.current.mutateAsync({ id: 'w1', updates: { quantity: 2 } });
    expect(mockDb.waste.update).toHaveBeenCalledWith('w1', { quantity: 2 });
  });

  it('useDeleteWasteLog forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteWasteLog());
    await result.current.mutateAsync('w1');
    expect(mockDb.waste.delete).toHaveBeenCalledWith('w1');
  });
});

// ─── Delivery Customers ─────────────────────────────────────────────────────

describe('delivery customer mutations', () => {
  it('useCreateDeliveryCustomer forwards full payload', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateDeliveryCustomer());
    const data = { name: 'A', phone: '1', address: 'X', notes: null };
    await result.current.mutateAsync(data);
    expect(mockDb.deliveryCustomers.create).toHaveBeenCalledWith(data);
  });

  it('useCreateDeliveryCustomer invalidates delivery customers', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateDeliveryCustomer());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ name: '', phone: '', address: '', notes: null });
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.DELIVERY_CUSTOMERS]);
  });

  it('useUpdateDeliveryCustomer forwards id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateDeliveryCustomer());
    await result.current.mutateAsync({ id: 'dc1', updates: { name: 'New' } });
    expect(mockDb.deliveryCustomers.update).toHaveBeenCalledWith('dc1', { name: 'New' });
  });

  it('useDeleteDeliveryCustomer forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteDeliveryCustomer());
    await result.current.mutateAsync('dc1');
    expect(mockDb.deliveryCustomers.delete).toHaveBeenCalledWith('dc1');
  });

  it('useIncrementDeliveryCustomerOrderCount forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() =>
      useIncrementDeliveryCustomerOrderCount(),
    );
    await result.current.mutateAsync('dc1');
    expect(mockDb.deliveryCustomers.incrementOrderCount).toHaveBeenCalledWith('dc1');
  });
});
