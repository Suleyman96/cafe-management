'use client';

import { ORDER_STATUS } from '@gustri/core';
import type { OrderWithDetails } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import {
  CheckCircle,
  ChefHat,
  Clock,
  CreditCard,
  Loader2,
  Package,
  Phone,
  Plus,
  Search,
  ThumbsUp,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import { CreateTakeoutModal } from '@/components/orders/create-takeout-modal';
import { useCancelOrder, useMenuItems, useTakeoutOrders, useUpdateOrderStatus } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useOrderFilters } from '@/hooks/use-order-filters';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

type TakeoutStatus = 'pending_approval' | 'new' | 'preparing' | 'ready' | 'closed' | 'cancelled';

const ORDER_STATUS_KEYS: Record<string, string> = {
  pending_approval: 'orders.pendingApproval',
  new: 'orders.new',
  preparing: 'orders.preparing',
  ready: 'orders.ready',
  served: 'orders.served',
  out_for_delivery: 'orders.outForDelivery',
  delivered: 'orders.delivered',
  closed: 'orders.closed',
  cancelled: 'orders.cancelled',
};

export default function TakeoutPage() {
  const { t } = useTranslation('staff');
  const router = useRouter();
  const { staff } = useAuth();
  const { data: orders, isLoading: loading, error, refetch } = useTakeoutOrders();
  const { data: menuItems } = useMenuItems();
  const updateOrderStatus = useUpdateOrderStatus();
  const cancelOrderMutation = useCancelOrder();
  const formatPrice = useFormatPrice();

  const takeoutSearchFields = useCallback(
    (order: OrderWithDetails, q: string) => !!order.customer_phone?.includes(q),
    [],
  );
  const { filteredOrders, statusFilter, setStatusFilter, searchTerm, setSearchTerm, activeCount } =
    useOrderFilters<TakeoutStatus>({
      orders,
      searchFields: takeoutSearchFields,
      activeStatuses: ['pending_approval', 'new', 'preparing', 'ready'],
    });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<OrderWithDetails | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Real-time: invalidate queries on DB changes
  useRealtimeSync('takeout-orders-realtime', [
    { table: 'orders', queryKeys: [['takeout_orders'], ['orders'], ['active_orders']] },
    { table: 'order_items', queryKeys: [['takeout_orders'], ['orders']] },
    { table: 'order_payments', queryKeys: [['takeout_orders'], ['payments']] },
  ]);

  const calculateOrderTotal = (order: OrderWithDetails) => {
    if (order?.total != null) return order.total;
    if (!order?.order_items) return 0;
    return order.order_items
      .filter((item) => item.status !== 'cancelled')
      .reduce((sum, item) => sum + item.quantity * item.item_price, 0);
  };

  const calculatePaidAmount = (order: OrderWithDetails) => {
    const payments = (order as OrderWithDetails & { order_payments?: { amount: number }[] })
      .order_payments;
    if (!payments) return 0;
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: TakeoutStatus) => {
    try {
      const statusKey = Object.entries(ORDER_STATUS).find(([_, value]) => value === newStatus)?.[0];
      if (!statusKey) throw new Error('Invalid status');

      await updateOrderStatus.mutateAsync({
        orderId,
        status: statusKey as keyof typeof ORDER_STATUS,
      });
      toast.success(`${t('orders.statusUpdated')} ${newStatus.replace(/_/g, ' ')}`);
    } catch (_error) {
      toast.error(t('takeout.failedUpdate'));
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderTarget || !cancelReason.trim()) {
      toast.error(t('orders.reasonRequired'));
      return;
    }

    setCancelling(true);
    try {
      await cancelOrderMutation.mutateAsync({
        orderId: cancelOrderTarget.id,
        reason: cancelReason.trim(),
        tableId: null,
      });
      toast.success(t('orders.orderCancelled'));
      setShowCancelModal(false);
      setCancelOrderTarget(null);
      setCancelReason('');
      refetch();
    } catch (_error) {
      toast.error(t('orders.failedCancel'));
    } finally {
      setCancelling(false);
    }
  };

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
              {activeCount} {t('takeout.activeCount')}
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
        {filteredOrders?.map((order) => {
          const grandTotal = calculateOrderTotal(order);
          const paid = calculatePaidAmount(order);
          const remaining = grandTotal - paid;
          const isFullyPaid = remaining === 0 && grandTotal > 0;

          return (
            <div
              key={order.id}
              className="border border-orange-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Package className="h-4 sm:h-5 w-4 sm:w-5 text-orange-600" />
                    <span
                      className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                    >
                      {order.status === 'ready'
                        ? t('takeout.readyForPickup')
                        : t(ORDER_STATUS_KEYS[order.status] || order.status)}
                    </span>
                    {order.order_number && (
                      <span className="text-xs text-gray-500">#{order.order_number}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(order.created_at)}
                    </span>
                    {order.customer_name && (
                      <span className="flex items-center gap-1 font-medium">
                        <User className="h-3 w-3" />
                        {order.customer_name}
                      </span>
                    )}
                    {order.customer_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {order.customer_phone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-base sm:text-lg font-semibold">
                    {formatPrice(grandTotal)}
                  </div>
                  {paid > 0 && (
                    <div className="text-xs sm:text-sm text-green-600">
                      {t('orders.paidAmount')} {formatPrice(paid)}
                    </div>
                  )}
                  {remaining > 0 && paid > 0 && (
                    <div className="text-xs sm:text-sm text-orange-600">
                      {t('orders.dueAmount')} {formatPrice(remaining)}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items Preview */}
              <div className="mb-3 text-sm text-gray-600">
                {order.order_items?.slice(0, 3).map((item) => (
                  <div key={item.id}>
                    {item.quantity}x {item.menu_item?.name || item.item_name}
                    {item.notes && <span className="text-xs text-gray-500"> ({item.notes})</span>}
                  </div>
                ))}
                {order.order_items?.length > 3 && (
                  <div className="text-gray-400">
                    {t('orders.moreItems', { count: order.order_items.length - 3 })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                {order.status === 'pending_approval' && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatusUpdate(order.id, 'new')}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {t('approve', { ns: 'common' })}
                  </Button>
                )}
                {order.status === 'new' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(order.id, 'preparing')}
                  >
                    <ChefHat className="h-4 w-4 mr-1" />
                    {t('orders.startPreparing')}
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(order.id, 'ready')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('orders.ready')}
                  </Button>
                )}
                {order.status === 'ready' && !isFullyPaid && (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(order);
                      setIsPaymentModalOpen(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    {t('orders.payment')}
                  </Button>
                )}
                {order.status === 'ready' && isFullyPaid && (
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => handleStatusUpdate(order.id, 'closed')}
                  >
                    <Package className="h-4 w-4 mr-1" />
                    {t('kitchen.pickedUp')}
                  </Button>
                )}
                {['pending_approval', 'new', 'preparing', 'ready'].includes(order.status) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setCancelOrderTarget(order);
                      setShowCancelModal(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {order.status === 'pending_approval'
                      ? t('reject', { ns: 'common' })
                      : t('cancel', { ns: 'common' })}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-600">
                {t('takeout.cancelTakeoutOrder')}
              </h2>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelOrderTarget(null);
                  setCancelReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {cancelOrderTarget && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">
                  {cancelOrderTarget.customer_name || t('takeout.title')}
                </p>
                <p className="text-sm text-gray-500">#{cancelOrderTarget.id.slice(0, 8)}</p>
              </div>
            )}

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
                  setCancelOrderTarget(null);
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
