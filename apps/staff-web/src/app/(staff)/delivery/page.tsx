'use client';

import { ACTIVE_DELIVERY_STATUSES, ORDER_STATUS, ORDER_STATUS_KEYS } from '@gustri/core';
import type { OrderWithDetails } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import { Plus, Search, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { DeliveryOrderCard } from '@/components/delivery/delivery-order-card';
import { CancelOrderModal } from '@/components/modals/cancel-order-modal';
import { CreateDeliveryModal } from '@/components/modals/create-delivery-modal';
import {
  useDeliveryOrders,
  useMarkDelivered,
  useMarkOutForDelivery,
  useMenuItems,
  useUpdateOrderStatus,
} from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useOrderFilters } from '@/hooks/use-order-filters';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

type DeliveryStatus =
  | 'pending_approval'
  | 'new'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export default function DeliveryPage() {
  const { t } = useTranslation('staff');
  const router = useRouter();
  const { staff } = useAuth();
  const { data: orders, isLoading: loading, error, refetch } = useDeliveryOrders();
  const { data: menuItems } = useMenuItems();
  const { mutateAsync: updateOrderStatusAsync } = useUpdateOrderStatus();
  const { mutateAsync: markOutForDeliveryAsync } = useMarkOutForDelivery();
  const { mutateAsync: markDeliveredAsync } = useMarkDelivered();
  const formatPrice = useFormatPrice();

  const deliverySearchFields = useCallback(
    (order: OrderWithDetails, q: string) =>
      !!order.delivery_address?.toLowerCase().includes(q) || !!order.customer_phone?.includes(q),
    [],
  );
  const { filteredOrders, statusFilter, setStatusFilter, searchTerm, setSearchTerm, activeCount } =
    useOrderFilters<DeliveryStatus>({
      orders,
      searchFields: deliverySearchFields,
      activeStatuses: [...ACTIVE_DELIVERY_STATUSES],
    });
  const [cancelOrderTarget, setCancelOrderTarget] = useState<OrderWithDetails | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const tenantId = useTenantId();

  // Real-time: invalidate queries on DB changes
  useRealtimeSync('delivery-orders-realtime', [
    {
      table: 'orders',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.DELIVERY_ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS),
      ],
    },
    {
      table: 'order_items',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.DELIVERY_ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
      ],
    },
  ]);

  const handleStatusUpdate = useCallback(
    async (orderId: string, newStatus: DeliveryStatus) => {
      try {
        const statusKey = Object.entries(ORDER_STATUS).find(
          ([_, value]) => value === newStatus,
        )?.[0];
        if (!statusKey) throw new Error('Invalid status');

        await updateOrderStatusAsync({
          orderId,
          status: statusKey as keyof typeof ORDER_STATUS,
        });
        toast.success(t('orders.statusUpdatedTo', { status: t(ORDER_STATUS_KEYS[newStatus]) }));
      } catch (_error) {
        toast.error(t('delivery.failedUpdate'));
      }
    },
    [updateOrderStatusAsync, t],
  );

  const handleMarkOutForDelivery = useCallback(
    async (orderId: string, deliveryPersonId?: string | null) => {
      if (!deliveryPersonId) {
        toast.error(t('delivery.failedUpdate'));
        return;
      }
      try {
        await markOutForDeliveryAsync({ orderId, deliveryPersonId });
        toast.success(t('delivery.outForDelivery'));
      } catch (_error) {
        toast.error(t('delivery.failedUpdate'));
      }
    },
    [markOutForDeliveryAsync, t],
  );

  const handleMarkDelivered = useCallback(
    async (orderId: string) => {
      try {
        await markDeliveredAsync(orderId);
        toast.success(t('delivery.markDelivered'));
      } catch (_error) {
        toast.error(t('delivery.failedUpdate'));
      }
    },
    [markDeliveredAsync, t],
  );

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
          {t('error', { ns: 'common' })}: {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-purple-600" />
          <h1 className="text-xl sm:text-2xl font-bold">{t('delivery.title')}</h1>
          {activeCount > 0 && (
            <span className="bg-purple-100 text-purple-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {t('delivery.activeCount', { count: activeCount })}
            </span>
          )}
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('delivery.newDeliveryOrder')}</span>
          <span className="sm:hidden">{t('orders.new')}</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder={t('delivery.searchDelivery')}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 border rounded-lg text-sm sm:text-base"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | 'all')}
          >
            <option value="all">{t('orders.allStatus')}</option>
            <option value="pending_approval">{t('orders.pendingApproval')}</option>
            <option value="new">{t('orders.new')}</option>
            <option value="preparing">{t('orders.preparing')}</option>
            <option value="ready">{t('orders.ready')}</option>
            <option value="out_for_delivery">{t('orders.outForDelivery')}</option>
            <option value="delivered">{t('orders.delivered')}</option>
            <option value="cancelled">{t('orders.cancelled')}</option>
          </select>
        </div>
      </div>

      {/* No orders state */}
      {(!filteredOrders || filteredOrders.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">{t('delivery.noDeliveryOrders')}</p>
          <p className="text-sm mt-1">
            {statusFilter !== 'all' ? t('delivery.noOrdersMatch') : t('delivery.ordersAppear')}
          </p>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredOrders?.map((order) => (
          <DeliveryOrderCard
            key={order.id}
            order={order}
            formatPrice={formatPrice}
            onStatusUpdate={handleStatusUpdate}
            onMarkOutForDelivery={handleMarkOutForDelivery}
            onMarkDelivered={handleMarkDelivered}
            onOpenCancel={setCancelOrderTarget}
          />
        ))}
      </div>

      {/* Cancel Order Modal */}
      {cancelOrderTarget && (
        <CancelOrderModal
          order={cancelOrderTarget}
          orderLabel={cancelOrderTarget.customer_name || t('delivery.title')}
          title={t('delivery.cancelDeliveryOrder')}
          onSuccess={() => {
            setCancelOrderTarget(null);
            refetch();
          }}
          onClose={() => setCancelOrderTarget(null)}
        />
      )}

      <CreateDeliveryModal
        staffId={staff?.id || ''}
        menuItems={menuItems || []}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(orderId) => {
          setIsCreateModalOpen(false);
          toast.success(t('orders.orderCreated'));
          router.push(`/orders/${orderId}`);
        }}
      />
    </div>
  );
}
