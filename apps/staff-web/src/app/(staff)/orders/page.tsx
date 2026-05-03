'use client';

import { ORDER_STATUS } from '@gustri/core';
import type { OrderWithDetails } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { Button, LoadingSpinner } from '@gustri/ui';
import { ClipboardList, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CancelOrderModal } from '@/components/modals/cancel-order-modal';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import { OrderListCard } from '@/components/orders/order-list-card';
import { useMarkDelivered, useMarkOutForDelivery, useOrders, useUpdateOrderStatus } from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

type OrderStatus =
  | 'pending_approval'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'out_for_delivery'
  | 'delivered'
  | 'paid'
  | 'cancelled';
type OrderSource = 'customer' | 'waiter' | 'phone' | 'delivery';

export default function OrdersPage() {
  const { t } = useTranslation('staff');
  // 30-day window keeps the orders list bounded. Orders older than this need a
  // dedicated history view with pagination — the wrapper used to silently cap
  // at 200 rows, so older orders disappeared as a tenant grew.
  const recentWindowStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const {
    data: orders,
    isLoading: loading,
    error,
    refetch,
  } = useOrders({ created_after: recentWindowStart });
  const updateOrderStatusMutation = useUpdateOrderStatus();
  const { mutateAsync: updateOrderStatusAsync } = updateOrderStatusMutation;
  const markOutForDeliveryMutation = useMarkOutForDelivery();
  const { mutateAsync: markOutForDeliveryAsync } = markOutForDeliveryMutation;
  const markDeliveredMutation = useMarkDelivered();
  const { mutateAsync: markDeliveredAsync } = markDeliveredMutation;
  // Aggregate pending state across the three mutations a row can trigger.
  // Whichever fired most recently owns `variables.orderId`; we disable that
  // row's status buttons so a triple-click produces 1 PATCH, not 3.
  const isStatusUpdatePending =
    updateOrderStatusMutation.isPending ||
    markOutForDeliveryMutation.isPending ||
    markDeliveredMutation.isPending;
  const pendingOrderId =
    (updateOrderStatusMutation.isPending && updateOrderStatusMutation.variables?.orderId) ||
    (markOutForDeliveryMutation.isPending && markOutForDeliveryMutation.variables?.orderId) ||
    (markDeliveredMutation.isPending && markDeliveredMutation.variables) ||
    null;
  const formatPrice = useFormatPrice();

  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<OrderSource | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');
  const [cancelOrderTarget, setCancelOrderTarget] = useState<OrderWithDetails | null>(null);
  const tenantId = useTenantId();

  // Get table filter from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableNumber = params.get('table');
    if (tableNumber) {
      setSelectedTableFilter(tableNumber);
    }
  }, []);

  // Real-time: invalidate queries on DB changes
  useRealtimeSync('orders-realtime', [
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
    {
      table: 'order_payments',
      queryKeys: [tenantKey(tenantId, QUERY_KEYS.ORDERS), tenantKey(tenantId, QUERY_KEYS.PAYMENTS)],
    },
  ]);

  // Keep latest orders in a ref so handleStatusUpdate can be a stable callback —
  // re-creating it on every refetch would invalidate every memoized OrderListCard.
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  const handleStatusUpdate = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      try {
        const order = ordersRef.current?.find((o) => o.id === orderId);
        const isDelivery = order?.order_type === 'delivery';

        if (isDelivery && newStatus === 'out_for_delivery') {
          if (!order.delivery_person_id) {
            toast.error(t('delivery.assignDriverFirst'));
            return;
          }
          await markOutForDeliveryAsync({
            orderId,
            deliveryPersonId: order.delivery_person_id,
          });
        } else if (isDelivery && newStatus === 'delivered') {
          await markDeliveredAsync(orderId);
        } else {
          const statusKey = Object.entries(ORDER_STATUS).find(
            ([_, value]) => value === newStatus,
          )?.[0];
          if (!statusKey) throw new Error('Invalid status');

          await updateOrderStatusAsync({
            orderId,
            status: statusKey as keyof typeof ORDER_STATUS,
          });
        }
        toast.success(`${t('orders.statusUpdated')} ${newStatus}`);
      } catch (_error) {
        toast.error(t('delivery.failedUpdate'));
      }
    },
    [markOutForDeliveryAsync, markDeliveredAsync, updateOrderStatusAsync, t],
  );

  const handleOpenPayment = useCallback((o: OrderWithDetails) => {
    setSelectedOrder(o);
    setIsPaymentModalOpen(true);
  }, []);

  // Filter orders
  const filteredOrders = orders?.filter((order) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (sourceFilter === 'delivery' && order.order_type !== 'delivery') return false;
    if (sourceFilter !== 'all' && sourceFilter !== 'delivery' && order.source !== sourceFilter)
      return false;
    if (selectedTableFilter !== 'all' && order.table?.table_number !== selectedTableFilter)
      return false;
    if (
      searchTerm &&
      !order.id.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !order.table?.table_number.toString().includes(searchTerm)
    )
      return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">
          {t('error', { ns: 'common' })}: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">{t('orders.title')}</h1>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder={t('orders.searchOrders')}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 sm:gap-4">
            <select
              className="flex-1 sm:flex-none px-3 py-2 border rounded-lg text-sm sm:text-base"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
            >
              <option value="all">{t('orders.allStatus')}</option>
              <option value="pending_approval">⏳ {t('orders.pendingApproval')}</option>
              <option value="new">{t('orders.new')}</option>
              <option value="preparing">{t('orders.preparing')}</option>
              <option value="ready">{t('orders.ready')}</option>
              <option value="served">{t('orders.served')}</option>
              <option value="out_for_delivery">{t('orders.outForDelivery')}</option>
              <option value="delivered">{t('orders.delivered')}</option>
              <option value="paid">{t('orders.paid')}</option>
              <option value="cancelled">{t('orders.cancelled')}</option>
            </select>

            <select
              className="flex-1 sm:flex-none px-3 py-2 border rounded-lg text-sm sm:text-base"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as OrderSource | 'all')}
            >
              <option value="all">{t('orders.allSources')}</option>
              <option value="customer">{t('orders.customer')}</option>
              <option value="waiter">{t('orders.waiter')}</option>
              <option value="phone">{t('orders.takeout')}</option>
              <option value="delivery">{t('orders.delivery')}</option>
            </select>
          </div>

          {selectedTableFilter !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTableFilter('all')}
              className="w-full sm:w-auto"
            >
              {t('orders.clearTableFilter')} ({selectedTableFilter})
            </Button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredOrders?.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500 mb-1">{t('orders.noOrders')}</p>
              <p className="text-sm text-gray-400">
                {statusFilter !== 'all'
                  ? t('orders.noOrdersWithStatus', { status: statusFilter })
                  : t('orders.noOrdersYet')}
              </p>
            </div>
          </div>
        ) : (
          filteredOrders?.map((order) => (
            <OrderListCard
              key={order.id}
              order={order}
              formatPrice={formatPrice}
              onStatusUpdate={handleStatusUpdate}
              onOpenPayment={handleOpenPayment}
              onOpenCancel={setCancelOrderTarget}
              isStatusUpdatePending={isStatusUpdatePending}
              pendingOrderId={pendingOrderId}
            />
          ))
        )}
      </div>

      {selectedOrder && (
        <SplitPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
            setSelectedOrder(null);
            toast.success(t('orders.payment'));
            refetch();
          }}
        />
      )}

      {/* Cancel Order Modal */}
      {cancelOrderTarget && (
        <CancelOrderModal
          order={cancelOrderTarget}
          orderLabel={
            cancelOrderTarget.table ? cancelOrderTarget.table.table_number : t('orders.takeout')
          }
          title={t('orders.cancelOrder')}
          onSuccess={() => {
            setCancelOrderTarget(null);
            refetch();
          }}
          onClose={() => setCancelOrderTarget(null)}
        />
      )}
    </div>
  );
}
