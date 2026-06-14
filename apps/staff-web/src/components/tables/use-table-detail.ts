'use client';

import {
  ACTIVE_ORDER_STATUSES,
  calculateOrderTotal,
  type ORDER_STATUS,
  ORDER_STATUS_KEYS,
} from '@gustri/core';
import type { Database, OrdersInsert } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import * as Sentry from '@sentry/nextjs';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  useAddOrderItems,
  useCancelOrder,
  useCancelOrderItem,
  useCategories,
  useCreateOrder,
  useMenuItems,
  useOrders,
  useTable,
  useTaxMultiplier,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { useStaffCart } from '@/hooks/use-staff-cart';
import { useActiveCallsForTable, useResolveWaiterCall } from '@/hooks/use-waiter-calls-safe';
import { toastLocalizedError } from '@/lib/toast/localized-error';
import type { OrderWithDetails } from '@/types';

export type MenuItem = Database['public']['Tables']['menu_items']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];

/**
 * Controller for the table-detail (POS) screen: data + realtime, the active-
 * order selection, the staff cart, derived totals, and every mutation handler
 * (create order, add items, status transitions, item/order cancellation,
 * resolve calls). Extracted verbatim from TableDetailPage — behavior unchanged.
 */
export function useTableDetail(tableId: string) {
  const router = useRouter();
  const { staff: currentStaff } = useAuth();
  const { t } = useTranslation('staff');

  const { data: table, isLoading: tableLoading } = useTable(tableId);
  // Most recent orders for this table. The cap prevents unbounded growth as
  // a popular table accumulates years of history.
  const { data: orders, isLoading: ordersLoading } = useOrders({ table_id: tableId, limit: 50 });
  const { data: menuItems, isLoading: menuLoading } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();

  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const cancelOrder = useCancelOrder();
  const cancelOrderItem = useCancelOrderItem();
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();
  const { data: activeCallsForTable } = useActiveCallsForTable(tableId);
  const resolveWaiterCall = useResolveWaiterCall();
  const tenantId = useTenantId();

  const handleResolveCalls = useCallback(async () => {
    if (!activeCallsForTable) return;
    try {
      await Promise.all(
        activeCallsForTable.map((call) => resolveWaiterCall.mutateAsync({ callId: call.id })),
      );
      toast.success(t('calls.resolved'));
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('calls.failedRespond'));
    }
  }, [activeCallsForTable, resolveWaiterCall, t]);

  const { cart, addToCart, removeFromCart, getCartQuantity, clearCart } = useStaffCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedOrderIndex, setSelectedOrderIndex] = useState(0);
  const [cancelItemConfirm, setCancelItemConfirm] = useState<OrderItem | null>(null);
  const [cancelItemQty, setCancelItemQty] = useState(1);
  const [cancellingItem, setCancellingItem] = useState(false);
  const [showItemTransferModal, setShowItemTransferModal] = useState(false);
  // Default closed: the order view (items + actions) is the landing state; the
  // menu opens on demand as a bottom sheet when the user taps "Add items".
  const [showMenu, setShowMenu] = useState(false);

  // Get ALL active orders for this table (including pending_approval)
  const activeOrders = useMemo((): OrderWithDetails[] => {
    return (
      orders?.filter((order) =>
        (ACTIVE_ORDER_STATUSES as readonly string[]).includes(order.status),
      ) || []
    );
  }, [orders]);

  // Get currently selected order
  const activeOrder = activeOrders[selectedOrderIndex] || activeOrders[0];

  // Reset selected order index when orders change
  useEffect(() => {
    if (selectedOrderIndex >= activeOrders.length && activeOrders.length > 0) {
      setSelectedOrderIndex(0);
    }
  }, [activeOrders.length, selectedOrderIndex]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on table navigation
  useEffect(() => {
    setSelectedOrderIndex(0);
  }, [tableId]);

  // An empty table has nothing to act on but adding items, so open the catalog
  // sheet automatically — but only on the *initial* load of a given table, not
  // whenever it later becomes empty mid-session (e.g. after paying or
  // cancelling the last order, which shouldn't yank the catalog open while the
  // user is reading the now-settled screen). The ref makes the decision once
  // per table; navigating to another table re-arms it.
  const autoOpenedForTableRef = useRef<string | null>(null);
  useEffect(() => {
    if (ordersLoading || autoOpenedForTableRef.current === tableId) return;
    autoOpenedForTableRef.current = tableId;
    if (activeOrders.length === 0) {
      setShowMenu(true);
    }
  }, [tableId, ordersLoading, activeOrders.length]);

  // Auto-select first category (no "All" option)
  useEffect(() => {
    if (categories?.length && selectedCategory === null) {
      // categories.length is truthy here, so [0] is present
      setSelectedCategory(categories[0]!.id);
    }
  }, [categories, selectedCategory]);

  // Create order with items (for new orders on free tables)
  const handleCreateOrderWithItems = async () => {
    if (cart.length === 0) {
      toast.error(t('orders.addAtLeastOneItem'));
      return;
    }

    setSubmitting(true);
    try {
      // First create the order. Totals are derived server-side once items
      // land — clients no longer send subtotal/tax/total.
      const newOrder = await createOrder.mutateAsync({
        table_id: tableId,
        order_type: 'dine_in',
        status: 'new',
        source: 'waiter',
        assigned_waiter_id: currentStaff?.id || null,
        customer_notes: orderNotes.trim() || null,
        customer_name: null,
        customer_phone: null,
      } as Partial<OrdersInsert> as OrdersInsert);

      // Then add the items
      const orderItems = cart.map((item) => ({
        order_id: newOrder.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        quantity: item.quantity,
        item_price: item.menuItem.price,
        notes: null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);
      toast.success(t('orders.orderCreatedSuccess'));
      clearCart();
      setOrderNotes('');
      // Order placed — dismiss the catalog so the new order is front-and-center.
      setShowMenu(false);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('orders.failedCreateOrder'));
    } finally {
      setSubmitting(false);
    }
  };

  // Real-time: invalidate queries on DB changes
  useRealtimeSync(`table-${tableId}`, [
    {
      table: 'orders',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS),
      ],
    },
    {
      table: 'order_items',
      queryKeys: [tenantKey(tenantId, QUERY_KEYS.ORDERS)],
    },
  ]);

  // Filter menu items by category
  const filteredItems = selectedCategory
    ? menuItems?.filter((item: MenuItem) => item.category_id === selectedCategory)
    : menuItems;

  // Calculate cart subtotal (tax is added at order level by DB trigger)
  const cartTotal = cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);

  const orderTotal = activeOrder ? calculateOrderTotal(activeOrder) : 0;

  // Calculate combined total for all orders on this table
  const combinedTotal = activeOrders.reduce(
    (total: number, order) => total + calculateOrderTotal(order),
    0,
  );

  // Submit cart items to existing order
  const handleAddItemsToOrder = async () => {
    if (cart.length === 0) {
      toast.error(t('orders.addAtLeastOneItem'));
      return;
    }

    if (!activeOrder) {
      toast.error(t('orders.noActiveOrder'));
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = cart.map((item) => ({
        order_id: activeOrder.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        quantity: item.quantity,
        item_price: item.menuItem.price,
        notes: null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);
      toast.success(t('orders.itemsAddedToOrder'));
      clearCart();
      // Items added — dismiss the catalog so the updated order is visible.
      setShowMenu(false);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('orders.failedAddItems'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (newStatus: keyof typeof ORDER_STATUS) => {
    if (!activeOrder) return;
    try {
      await updateOrderStatus.mutateAsync({
        orderId: activeOrder.id,
        status: newStatus,
      });
      toast.success(
        t('orders.statusUpdatedTo', { status: t(ORDER_STATUS_KEYS[newStatus] ?? newStatus) }),
      );
    } catch (_error) {
      toast.error(t('orders.failedUpdateStatus'));
    }
  };

  // Handle item status update. Order-level status is synced server-side by the
  // `trg_sync_order_status_from_items` DB trigger (migration 20260606000003) —
  // the previous client-side recompute + second `updateOrderStatus` write here
  // was redundant and could race/flap the status against the trigger. Mirrors
  // the cleaned sibling in `components/orders/use-order-detail.ts`.
  const handleItemStatusUpdate = async (itemId: string, newStatus: string) => {
    try {
      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
      });
      toast.success(t('orders.itemMarkedAs', { status: newStatus }));
    } catch (_error) {
      toast.error(t('orders.failedUpdateItemStatus'));
    }
  };

  // Handle individual item cancellation (supports partial quantity)
  const handleCancelItem = async () => {
    if (!cancelItemConfirm || !activeOrder) return;

    setCancellingItem(true);
    try {
      await cancelOrderItem.mutateAsync({
        itemId: cancelItemConfirm.id,
        cancelQty: cancelItemQty,
      });
      toast.success(
        t('orders.itemCancelled', {
          item: `${cancelItemQty}x ${cancelItemConfirm.item_name}`,
        }),
      );
      setCancelItemConfirm(null);
      setCancelItemQty(1);
    } catch (error: unknown) {
      toastLocalizedError(error, t('orders.failedCancelItem'));
    } finally {
      setCancellingItem(false);
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async () => {
    if (!activeOrder || !cancelReason.trim()) {
      toast.error(t('orders.reasonProvide'));
      return;
    }

    setCancelling(true);
    try {
      await cancelOrder.mutateAsync({
        orderId: activeOrder.id,
        reason: cancelReason.trim(),
        tableId: activeOrder.table_id,
      });
      toast.success(t('orders.orderCancelled'));
      setShowCancelModal(false);
      setCancelReason('');

      // If there are other orders, stay on page, otherwise go back
      if (activeOrders.length <= 1) {
        router.push('/tables');
      }
    } catch (error) {
      Sentry.captureException(error);
      toastLocalizedError(error, t('orders.failedCancel'));
    } finally {
      setCancelling(false);
    }
  };

  return {
    // data
    table,
    loading: tableLoading || menuLoading,
    categories,
    filteredItems,
    activeOrders,
    activeOrder,
    activeCallsForTable,
    resolveWaiterCall,
    // derived totals
    cartTotal,
    orderTotal,
    combinedTotal,
    taxMultiplier,
    formatPrice,
    // cart
    cart,
    addToCart,
    removeFromCart,
    getCartQuantity,
    // selection + view state
    selectedCategory,
    setSelectedCategory,
    selectedOrderIndex,
    setSelectedOrderIndex,
    showMenu,
    setShowMenu,
    orderNotes,
    setOrderNotes,
    submitting,
    // cancel-order modal
    showCancelModal,
    setShowCancelModal,
    cancelReason,
    setCancelReason,
    cancelling,
    // cancel-item modal
    cancelItemConfirm,
    setCancelItemConfirm,
    cancelItemQty,
    setCancelItemQty,
    cancellingItem,
    // transfer modal
    showItemTransferModal,
    setShowItemTransferModal,
    // handlers
    handleResolveCalls,
    handleCreateOrderWithItems,
    handleAddItemsToOrder,
    handleStatusUpdate,
    handleItemStatusUpdate,
    handleCancelItem,
    handleCancelOrder,
  };
}
