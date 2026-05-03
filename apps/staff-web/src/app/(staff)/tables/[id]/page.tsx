'use client';

import {
  ACTIVE_ORDER_STATUSES,
  calculateOrderTotal,
  formatElapsedTime,
  type ORDER_STATUS,
  ORDER_STATUS_KEYS,
} from '@gustri/core';
import type { Database, OrdersInsert } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { Button, getOrderStatusColor, LoadingSpinner } from '@gustri/ui';
import * as Sentry from '@sentry/nextjs';
import {
  ArrowLeft,
  ArrowRightLeft,
  Bell,
  CheckCircle,
  ChefHat,
  Clock,
  CreditCard,
  DollarSign,
  Layers,
  Loader2,
  Minus,
  Plus,
  Smartphone,
  ThumbsUp,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ItemTransferModal } from '@/components/modals/item-transfer-modal';
import { OrderItemsList } from '@/components/tables/order-items-list';
import { TableCart } from '@/components/tables/table-cart';
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
import type { OrderWithDetails } from '@/types';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];

export default function TableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.id as string;
  const { staff: currentStaff } = useAuth();
  const { t } = useTranslation('staff');

  const { data: table, isLoading: tableLoading } = useTable(tableId);
  // Most recent orders for this table. The cap prevents unbounded growth as
  // a popular table accumulates years of history.
  const { data: orders } = useOrders({ table_id: tableId, limit: 50 });
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
  const [showMenu, setShowMenu] = useState(true);

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

  // Auto-select first category (no "All" option)
  useEffect(() => {
    if (categories?.length && selectedCategory === null) {
      setSelectedCategory(categories[0].id);
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
      toast.success(`${t('orders.statusUpdated')} ${newStatus.toLowerCase()}`);
    } catch (_error) {
      toast.error(t('orders.failedUpdateStatus'));
    }
  };

  // Handle item status update — also syncs order-level status based on collective item states
  const handleItemStatusUpdate = async (itemId: string, newStatus: string) => {
    try {
      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
      });

      // Sync order status based on updated item states
      if (activeOrder?.order_items) {
        const updatedItems = activeOrder.order_items.map((item: OrderItem) =>
          item.id === itemId ? { ...item, status: newStatus } : item,
        );
        type ItemWithStatus = { status: string };
        const nonCancelled = updatedItems.filter((i: ItemWithStatus) => i.status !== 'cancelled');

        if (nonCancelled.length > 0) {
          const allServed = nonCancelled.every((i: ItemWithStatus) => i.status === 'served');
          const allReadyOrServed = nonCancelled.every(
            (i: ItemWithStatus) => i.status === 'ready' || i.status === 'served',
          );
          const anyPreparing = nonCancelled.some((i: ItemWithStatus) => i.status === 'preparing');

          let targetStatus: keyof typeof ORDER_STATUS | null = null;
          if (allServed && activeOrder.status !== 'served') {
            targetStatus = 'SERVED';
          } else if (allReadyOrServed && !allServed && activeOrder.status !== 'ready') {
            targetStatus = 'READY';
          } else if (anyPreparing && activeOrder.status === 'new') {
            targetStatus = 'PREPARING';
          }

          if (targetStatus) {
            await updateOrderStatus.mutateAsync({
              orderId: activeOrder.id,
              status: targetStatus,
            });
          }
        }
      }

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
      const message = error instanceof Error ? error.message : t('orders.failedCancelItem');
      toast.error(message);
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
      toast.error(t('orders.failedCancel'));
    } finally {
      setCancelling(false);
    }
  };

  if (tableLoading || menuLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">{t('tables.tableNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header + Order Info */}
      <div
        className={`flex-shrink-0 overflow-y-auto px-3 sm:px-4 pt-4 sm:pt-6 pb-2 ${cart.length > 0 ? 'max-h-[25vh]' : 'max-h-[40vh]'}`}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/tables')}>
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('back', { ns: 'common' })}</span>
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">{table.table_number}</h1>
            {activeOrder && (
              <span
                className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getOrderStatusColor(activeOrder.status)}`}
              >
                {t(ORDER_STATUS_KEYS[activeOrder.status] || activeOrder.status)}
              </span>
            )}
          </div>
        </div>

        {/* Waiter Call Banner */}
        {activeCallsForTable && activeCallsForTable.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                {activeCallsForTable[0].reason || t('calls.needAssistance')}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              disabled={resolveWaiterCall.isPending}
              onClick={handleResolveCalls}
            >
              {resolveWaiterCall.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <CheckCircle className="h-3 w-3 mr-1" />
              )}
              {t('calls.resolve')}
            </Button>
          </div>
        )}

        {/* Multiple Orders Tab Selector */}
        {activeOrders.length > 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                {activeOrders.length} {t('tables.ordersOnTable')}
              </span>
              <span className="text-sm text-amber-600">
                ({t('tables.combinedTotal')}: {formatPrice(combinedTotal)})
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {activeOrders.map((order, index) => {
                const orderItemsTotal =
                  order.order_items
                    ?.filter((item: OrderItem) => item.status !== 'cancelled')
                    .reduce(
                      (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
                      0,
                    ) ?? 0;
                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderIndex(index)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedOrderIndex === index
                        ? 'bg-amber-500 text-white'
                        : 'bg-white text-amber-700 hover:bg-amber-100 border border-amber-300'
                    }`}
                  >
                    {t('orders.order')} #{index + 1} ({formatPrice(orderItemsTotal)})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active order info */}
        {activeOrder && (
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatElapsedTime(activeOrder.created_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {formatPrice(orderTotal)}
                  </span>
                  {/* Order Taken By */}
                  {activeOrder.assigned_waiter && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">
                        {t('orders.takenBy')} {activeOrder.assigned_waiter.full_name}
                      </span>
                    </span>
                  )}
                </div>
                {/* Customer Notes */}
                {activeOrder.customer_notes && (
                  <div className="mt-2 p-2 bg-amber-100 rounded-lg border border-amber-300">
                    <p className="text-sm text-amber-800">
                      <span className="font-medium">{t('notes', { ns: 'common' })}:</span>{' '}
                      {activeOrder.customer_notes}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Pending Approval: Show approve button and QR indicator */}
                {activeOrder.status === 'pending_approval' && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleStatusUpdate('NEW')}
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      {t('approve', { ns: 'common' })}
                    </Button>
                    {activeOrder.source === 'customer' && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                        <Smartphone className="h-3 w-3" />
                        {t('orders.qrOrder')}
                      </span>
                    )}
                  </>
                )}
                {activeOrder.status === 'new' && (
                  <Button size="sm" onClick={() => handleStatusUpdate('PREPARING')}>
                    <ChefHat className="h-4 w-4 mr-1" />
                    <span className="hidden xs:inline">{t('start', { ns: 'common' })} </span>
                    {t('orders.preparing')}
                  </Button>
                )}
                {activeOrder.status === 'preparing' && (
                  <Button size="sm" onClick={() => handleStatusUpdate('READY')}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="hidden xs:inline">{t('mark', { ns: 'common' })} </span>
                    {t('orders.ready')}
                  </Button>
                )}
                {activeOrder.status === 'ready' && (
                  <Button size="sm" onClick={() => handleStatusUpdate('SERVED')}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span className="hidden xs:inline">{t('mark', { ns: 'common' })} </span>
                    {t('orders.served')}
                  </Button>
                )}
                {activeOrder.status === 'served' && (
                  <Button size="sm" onClick={() => router.push(`/orders/${activeOrder.id}`)}>
                    <CreditCard className="h-4 w-4 mr-1" />
                    {t('orders.payment')}
                  </Button>
                )}
                {/* Transfer Items button */}
                {activeOrder.order_items?.some((i: OrderItem) => i.status !== 'cancelled') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowItemTransferModal(true)}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-1" />
                    {t('tables.transferItems')}
                  </Button>
                )}
                {/* Cancel/Reject button - available for active orders */}
                {(ACTIVE_ORDER_STATUSES as readonly string[]).includes(activeOrder.status) && (
                  <Button size="sm" variant="destructive" onClick={() => setShowCancelModal(true)}>
                    <XCircle className="h-4 w-4 mr-1" />
                    {activeOrder.status === 'pending_approval'
                      ? t('reject', { ns: 'common' })
                      : t('cancel', { ns: 'common' })}
                  </Button>
                )}
              </div>
            </div>

            {/* Current order items */}
            <OrderItemsList
              items={activeOrder.order_items || []}
              onItemStatusUpdate={handleItemStatusUpdate}
              onCancelItem={(item) => {
                setCancelItemConfirm(item);
                setCancelItemQty(1);
              }}
              formatPrice={formatPrice}
            />
          </div>
        )}
      </div>

      {/* Menu — categories sidebar + items grid */}
      {showMenu ? (
        <div
          className={`flex flex-col min-h-0 overflow-hidden ${cart.length > 0 ? 'h-[35%] flex-shrink-0' : 'flex-1'}`}
        >
          {/* Menu Header with Close Button */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-700">{t('menu', { ns: 'nav' })}</h2>
            <button
              type="button"
              onClick={() => setShowMenu(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-3 px-3 sm:px-4 min-h-0 flex-1 overflow-hidden">
            {/* Category Sidebar */}
            <div className="w-24 sm:w-32 lg:w-44 flex-shrink-0 overflow-y-auto py-2">
              <div className="space-y-1">
                {categories?.map((category: Category) => (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2.5 rounded-lg text-sm transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span className="text-lg flex-shrink-0">{category.icon || '📋'}</span>
                    <span className="truncate text-xs sm:text-sm">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 min-w-0 overflow-y-auto py-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {filteredItems?.map((item: MenuItem) => {
                  const quantity = getCartQuantity(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-3 sm:p-4 cursor-pointer transition-all ${
                        quantity > 0 ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                      }`}
                      onClick={() => addToCart(item)}
                    >
                      <div className="flex justify-between items-start mb-1 sm:mb-2">
                        <h3 className="font-medium text-xs sm:text-sm line-clamp-2">{item.name}</h3>
                        {quantity > 0 && (
                          <span className="bg-blue-500 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ml-1 flex-shrink-0">
                            {quantity}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-500 mb-1 sm:mb-2 line-clamp-2 hidden sm:block">
                          {item.description}
                        </p>
                      )}
                      <p className="font-semibold text-blue-600 text-sm sm:text-base">
                        {formatPrice(item.price * taxMultiplier)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-3 sm:px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => setShowMenu(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('orders.addItems')}
          </Button>
        </div>
      )}

      {/* Cart — bottom half */}
      {cart.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <TableCart
            cart={cart}
            activeOrder={activeOrder}
            selectedOrderIndex={selectedOrderIndex}
            submitting={submitting}
            orderNotes={orderNotes}
            cartTotal={cartTotal}
            formatPrice={formatPrice}
            onAddToCart={addToCart}
            onRemoveFromCart={removeFromCart}
            onSetOrderNotes={setOrderNotes}
            onSubmit={activeOrder ? handleAddItemsToOrder : handleCreateOrderWithItems}
          />
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-600">{t('orders.cancelOrder')}</h2>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-gray-600 mb-4">{t('orders.reasonRequired')}</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('orders.cancellationReason')} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t('orders.reasonPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={cancelling}
              >
                {t('orders.keepOrder')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancelOrder}
                disabled={cancelling || !cancelReason.trim()}
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('orders.cancelling')}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    {t('orders.cancelOrder')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Item Confirmation with Quantity Selector */}
      {cancelItemConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-bold mb-2">{t('orders.cancelItem')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('orders.cancelItemConfirm')} <strong>{cancelItemConfirm.item_name}</strong>?
            </p>

            {/* Quantity selector — only show if item has quantity > 1 */}
            {cancelItemConfirm.quantity > 1 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('orders.cancelQuantity')}
                </label>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setCancelItemQty((q) => Math.max(1, q - 1))}
                    disabled={cancelItemQty <= 1}
                    className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-bold w-8 text-center">{cancelItemQty}</span>
                  <button
                    onClick={() =>
                      setCancelItemQty((q) => Math.min(cancelItemConfirm.quantity, q + 1))
                    }
                    disabled={cancelItemQty >= cancelItemConfirm.quantity}
                    className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-500">/ {cancelItemConfirm.quantity}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCancelItemConfirm(null);
                  setCancelItemQty(1);
                }}
                disabled={cancellingItem}
              >
                {t('orders.keepItem')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancelItem}
                disabled={cancellingItem}
              >
                {cancellingItem ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `${t('orders.cancelItem')} (${cancelItemQty})`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Item Transfer Modal */}
      {activeOrder && (
        <ItemTransferModal
          isOpen={showItemTransferModal}
          onClose={() => setShowItemTransferModal(false)}
          order={activeOrder}
          sourceTableId={tableId}
          onSuccess={() => {
            setShowItemTransferModal(false);
            toast.success(t('tables.itemsTransferred'));
          }}
        />
      )}
    </div>
  );
}
