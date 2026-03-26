import { QUERY_KEYS } from '@cafe-idare/core';
import {
  useAddDeliveryOrderItems,
  useCreateDeliveryOrder,
  useDeliveryOrder,
} from '@/hooks/use-delivery';
import { db, supabase } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useDeliveryOrder', () => {
  it('calls db.orders.findDeliveryById with orderId', () => {
    renderHookWithProviders(() => useDeliveryOrder('order-1'));
    expect(db.orders.findDeliveryById).toHaveBeenCalledWith('order-1');
  });

  it('is disabled when orderId is empty', () => {
    renderHookWithProviders(() => useDeliveryOrder(''));
    expect(db.orders.findDeliveryById).not.toHaveBeenCalled();
  });

  it('sets up a realtime channel', () => {
    renderHookWithProviders(() => useDeliveryOrder('order-1'));
    expect(supabase.channel).toHaveBeenCalledWith('delivery_order:order-1');
  });

  it('does not set up channel when orderId is empty', () => {
    renderHookWithProviders(() => useDeliveryOrder(''));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it('cleans up realtime channel on unmount', () => {
    const { unmount } = renderHookWithProviders(() => useDeliveryOrder('order-1'));
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });
});

describe('useCreateDeliveryOrder', () => {
  it('calls db.orders.create with delivery-specific fields', async () => {
    const { result } = renderHookWithProviders(() => useCreateDeliveryOrder());

    await result.current.mutateAsync({
      customerName: 'John',
      customerPhone: '+994551234567',
      deliveryAddress: '123 Main St',
      deliveryNotes: 'Ring the bell',
      deliveryFee: 5,
      orderNotes: 'Extra napkins',
    });

    expect(db.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        table_id: null,
        order_type: 'delivery',
        source: 'customer',
        status: 'pending_approval',
        customer_name: 'John',
        customer_phone: '+994551234567',
        delivery_address: '123 Main St',
        delivery_notes: 'Ring the bell',
        delivery_fee: 5,
        customer_notes: 'Extra napkins',
        subtotal: 0,
        tax: 0,
        total: 0,
      }),
    );
  });

  it('converts empty deliveryNotes to null (uses || null)', async () => {
    const { result } = renderHookWithProviders(() => useCreateDeliveryOrder());

    await result.current.mutateAsync({
      customerName: 'John',
      customerPhone: '+994551234567',
      deliveryAddress: '123 Main St',
      deliveryNotes: '',
      deliveryFee: 0,
    });

    expect(db.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_notes: null,
        customer_notes: null,
      }),
    );
  });

  it('invalidates DELIVERY_ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateDeliveryOrder());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      customerName: 'John',
      customerPhone: '+994551234567',
      deliveryAddress: '123 Main St',
      deliveryNotes: '',
      deliveryFee: 0,
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDER]);
  });
});

describe('useAddDeliveryOrderItems', () => {
  it('maps notes undefined to null and sets status to pending', async () => {
    const { result } = renderHookWithProviders(() => useAddDeliveryOrderItems());

    await result.current.mutateAsync({
      orderId: 'order-1',
      items: [
        { menu_item_id: 'm1', item_name: 'Pizza', item_price: 12, quantity: 1 },
        { menu_item_id: 'm2', item_name: 'Salad', item_price: 8, quantity: 1, notes: 'No onions' },
      ],
    });

    expect(db.orderItems.create).toHaveBeenCalledWith([
      {
        order_id: 'order-1',
        menu_item_id: 'm1',
        item_name: 'Pizza',
        item_price: 12,
        quantity: 1,
        notes: null,
        status: 'pending',
      },
      {
        order_id: 'order-1',
        menu_item_id: 'm2',
        item_name: 'Salad',
        item_price: 8,
        quantity: 1,
        notes: 'No onions',
        status: 'pending',
      },
    ]);
  });

  it('invalidates DELIVERY_ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAddDeliveryOrderItems());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      orderId: 'order-1',
      items: [{ menu_item_id: 'm1', item_name: 'Pizza', item_price: 12, quantity: 1 }],
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDER]);
  });
});
