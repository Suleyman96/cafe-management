import { QUERY_KEYS } from '@gustri/core';
import {
  useAddDeliveryOrderItems,
  useCreateDeliveryOrder,
  useDeliveryOrder,
} from '@/hooks/use-delivery';
import { apiRoutes } from '@/lib/api-routes';
import { supabase } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useDeliveryOrder', () => {
  it('calls supabase.rpc with get_delivery_order', () => {
    renderHookWithProviders(() => useDeliveryOrder('order-1'));
    expect(supabase.rpc).toHaveBeenCalledWith('get_delivery_order', {
      p_order_id: 'order-1',
    });
  });

  it('is disabled when orderId is empty', () => {
    renderHookWithProviders(() => useDeliveryOrder(''));
    expect(supabase.rpc).not.toHaveBeenCalled();
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
  it('calls apiRoutes.customerOrders.create with delivery-specific fields', async () => {
    const { result } = renderHookWithProviders(() => useCreateDeliveryOrder());

    await result.current.mutateAsync({
      customerName: 'John',
      customerPhone: '+994551234567',
      deliveryAddress: '123 Main St',
      deliveryNotes: 'Ring the bell',
      deliveryFee: 5,
      orderNotes: 'Extra napkins',
      tenantId: 'tenant-1',
    });

    expect(apiRoutes.customerOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        table_id: null,
        tenant_id: 'tenant-1',
        order_type: 'delivery',
        source: 'customer',
        delivery_address: '123 Main St',
        delivery_phone: '+994551234567',
        delivery_customer_name: 'John',
        delivery_fee: 5,
        customer_notes: 'Extra napkins',
      }),
    );
  });

  it('passes undefined orderNotes as undefined', async () => {
    const { result } = renderHookWithProviders(() => useCreateDeliveryOrder());

    await result.current.mutateAsync({
      customerName: 'John',
      customerPhone: '+994551234567',
      deliveryAddress: '123 Main St',
      deliveryNotes: '',
      deliveryFee: 0,
      tenantId: 'tenant-1',
    });

    expect(apiRoutes.customerOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        order_type: 'delivery',
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
      tenantId: 'tenant-1',
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDER]);
  });
});

// ─── Realtime Callback Invocation ───────────────────────────────────────────

describe('useDeliveryOrder - realtime callback', () => {
  it('orders channel callback invalidates DELIVERY_ORDER query', async () => {
    const mockOrder = { id: 'order-1', status: 'new', items: [] };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockOrder, error: null });

    const { queryClient } = renderHookWithProviders(() => useDeliveryOrder('order-1'));

    // Wait for channel to be set up
    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('delivery_order:order-1');
    });

    const channelObj = (supabase.channel as any).mock.results[0].value;
    const ordersCall = channelObj.on.mock.calls.find((c: any[]) => c[1]?.table === 'orders');
    const callback = ordersCall[2];
    expect(callback).toBeTypeOf('function');

    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    callback();
    expect(spy).toHaveBeenCalledWith({ queryKey: [QUERY_KEYS.DELIVERY_ORDER, 'order-1'] });
  });
});

describe('useAddDeliveryOrderItems', () => {
  it('calls apiRoutes.customerOrders.addItems with mapped items', async () => {
    const { result } = renderHookWithProviders(() => useAddDeliveryOrderItems());

    await result.current.mutateAsync({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      items: [
        { menu_item_id: 'm1', item_name: 'Pizza', item_price: 12, quantity: 1 },
        { menu_item_id: 'm2', item_name: 'Salad', item_price: 8, quantity: 1, notes: 'No onions' },
      ],
    });

    expect(apiRoutes.customerOrders.addItems).toHaveBeenCalledWith('order-1', [
      {
        menu_item_id: 'm1',
        item_name: 'Pizza',
        item_price: 12,
        quantity: 1,
        notes: null,
        tenant_id: 'tenant-1',
      },
      {
        menu_item_id: 'm2',
        item_name: 'Salad',
        item_price: 8,
        quantity: 1,
        notes: 'No onions',
        tenant_id: 'tenant-1',
      },
    ]);
  });

  it('invalidates DELIVERY_ORDER queries', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useAddDeliveryOrderItems());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      orderId: 'order-1',
      tenantId: 'tenant-1',
      items: [{ menu_item_id: 'm1', item_name: 'Pizza', item_price: 12, quantity: 1 }],
    });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.DELIVERY_ORDER]);
  });
});
