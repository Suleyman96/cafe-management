'use client';

import { ACTIVE_TAKEOUT_STATUSES, ORDER_STATUS, ORDER_STATUS_KEYS } from '@gustri/core';
import type { OrderWithDetails } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import { Package, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { CancelOrderModal } from '@/components/modals/cancel-order-modal';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import { CreateTakeoutModal } from '@/components/orders/create-takeout-modal';
import { TakeoutOrderCard } from '@/components/takeout/takeout-order-card';
import { useMenuItems, useTakeoutOrders, useUpdateOrderStatus } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useOrderFilters } from '@/hooks/use-order-filters';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

type TakeoutStatus = 'pending_approval' | 'new' | 'preparing' | 'ready' | 'closed' | 'cancelled';

export default function TakeoutPage() {
  const { t } = useTranslation('staff');
  const router = useRouter();
  const { staff } = useAuth();
  const { data: orders, isLoading: loading, error, refetch } = useTakeoutOrders();
  const { data: menuItems } = useMenuItems();
  const { mutateAsync: updateOrderStatusAsync } = useUpdateOrderStatus();
  const formatPrice = useFormatPrice();

  const takeoutSearchFields = useCallback(
    (order: OrderWithDetails, q: string) => !!order.customer_phone?.includes(q),
    [],
  );
  const { filteredOrders, statusFilter, setStatusFilter, searchTerm, setSearchTerm, activeCount } =
    useOrderFilters<TakeoutStatus>({
      orders,
      searchFields: takeoutSearchFields,
      activeStatuses: [...ACTIVE_TAKEOUT_STATUSES],
    });
  const [cancelOrderTarget, setCancelOrderTarget] = useState<OrderWithDetails | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const tenantId = useTenantId();

  // Real-time: invalidate queries on DB changes
  useRealtimeSync('takeout-orders-realtime', [
    {
      table: 'orders',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.TAKEOUT_ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS),
      ],
    },
    {
      table: 'order_items',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.TAKEOUT_ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
      ],
    },
    {
      table: 'order_payments',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.TAKEOUT_ORDERS),
        tenantKey(tenantId, QUERY_KEYS.PAYMENTS),
      ],
    },
  ]);

  const handleStatusUpdate = useCallback(
    async (orderId: string, newStatus: TakeoutStatus) => {
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
        toast.error(t('takeout.failedUpdate'));
      }
    },
    [updateOrderStatusAsync, t],
  );

  const handleOpenPayment = useCallback((o: OrderWithDetails) => {
    setSelectedOrder(o);
    setIsPaymentModalOpen(true);
  }, []);

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
          <Package className="h-6 w-6 text-orange-600" />
          <h1 className="text-xl sm:text-2xl font-bold">{t('takeout.title')}</h1>
          {activeCount > 0 && (
            <span className="bg-orange-100 text-orange-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {t('takeout.activeCount', { count: activeCount })}
            </span>
          )}
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('takeout.newTakeoutOrder')}</span>
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
              placeholder={t('takeout.searchTakeout')}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 border rounded-lg text-sm sm:text-base"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TakeoutStatus | 'all')}
          >
            <option value="all">{t('orders.allStatus')}</option>
            <option value="pending_approval">{t('orders.pendingApproval')}</option>
            <option value="new">{t('orders.new')}</option>
            <option value="preparing">{t('orders.preparing')}</option>
            <option value="ready">{t('orders.ready')}</option>
            <option value="closed">{t('orders.closed')}</option>
            <option value="cancelled">{t('orders.cancelled')}</option>
          </select>
        </div>
      </div>

      {/* No orders state */}
      {(!filteredOrders || filteredOrders.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">{t('takeout.noTakeoutOrders')}</p>
          <p className="text-sm mt-1">
            {statusFilter !== 'all' ? t('takeout.noOrdersMatch') : t('takeout.ordersAppear')}
          </p>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredOrders?.map((order) => (
          <TakeoutOrderCard
            key={order.id}
            order={order}
            formatPrice={formatPrice}
            onStatusUpdate={handleStatusUpdate}
            onOpenPayment={handleOpenPayment}
            onOpenCancel={setCancelOrderTarget}
          />
        ))}
      </div>

      {/* Cancel Order Modal */}
      {cancelOrderTarget && (
        <CancelOrderModal
          order={cancelOrderTarget}
          orderLabel={cancelOrderTarget.customer_name || t('takeout.title')}
          title={t('takeout.cancelTakeoutOrder')}
          onSuccess={() => {
            setCancelOrderTarget(null);
            refetch();
          }}
          onClose={() => setCancelOrderTarget(null)}
        />
      )}

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

      <CreateTakeoutModal
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
