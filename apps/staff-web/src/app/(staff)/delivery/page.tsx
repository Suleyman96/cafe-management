'use client';

import { ORDER_STATUS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import {
  CheckCircle,
  ChefHat,
  Clock,
  Loader2,
  Map as MapIcon,
  MapPin,
  Phone,
  Plus,
  Search,
  ThumbsUp,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CreateDeliveryModal } from '@/components/modals/create-delivery-modal';
import {
  useCancelOrder,
  useDeliveryOrders,
  useMarkDelivered,
  useMarkOutForDelivery,
  useMenuItems,
  useUpdateOrderStatus,
} from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';
import { supabase } from '@/lib/supabase/client';

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
  const updateOrderStatus = useUpdateOrderStatus();
  const markOutForDelivery = useMarkOutForDelivery();
  const markDelivered = useMarkDelivered();
  const cancelOrderMutation = useCancelOrder();
  const formatPrice = useFormatPrice();

  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('delivery-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const calculateOrderTotal = (order: any) => {
    if (order?.total != null) return order.total;
    if (!order?.order_items) return 0;
    return order.order_items
      .filter((item: any) => item.status !== 'cancelled')
      .reduce((sum: number, item: any) => sum + item.quantity * item.item_price, 0);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'out_for_delivery':
        return 'bg-violet-100 text-violet-800';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: DeliveryStatus) => {
    try {
      const statusKey = Object.entries(ORDER_STATUS).find(([_, value]) => value === newStatus)?.[0];
      if (!statusKey) throw new Error('Invalid status');

      await updateOrderStatus.mutateAsync({
        orderId,
        status: statusKey as keyof typeof ORDER_STATUS,
      });
      toast.success(`${t('orders.statusUpdated')} ${newStatus.replace(/_/g, ' ')}`);
    } catch (_error) {
      toast.error(t('delivery.failedUpdate'));
    }
  };

  const handleMarkOutForDelivery = async (orderId: string, deliveryPersonId?: string) => {
    if (!deliveryPersonId) {
      toast.error(t('delivery.failedUpdate'));
      return;
    }
    try {
      await markOutForDelivery.mutateAsync({ orderId, deliveryPersonId });
      toast.success(t('delivery.outForDelivery'));
    } catch (_error) {
      toast.error(t('delivery.failedUpdate'));
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      await markDelivered.mutateAsync(orderId);
      toast.success(t('delivery.markDelivered'));
    } catch (_error) {
      toast.error(t('delivery.failedUpdate'));
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

  const filteredOrders = orders?.filter((order: any) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (
      searchTerm &&
      !order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !order.delivery_address?.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !order.customer_phone?.includes(searchTerm) &&
      !order.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    return true;
  });

  // Count active delivery orders
  const activeCount =
    orders?.filter((o: any) =>
      ['pending_approval', 'new', 'preparing', 'ready', 'out_for_delivery'].includes(o.status),
    ).length || 0;

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
              {activeCount} {t('delivery.activeCount')}
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
        {filteredOrders?.map((order: any) => {
          const grandTotal = calculateOrderTotal(order); // already includes delivery_fee from DB
          const deliveryFee = order.delivery_fee ?? 0;

          return (
            <div
              key={order.id}
              className="border border-purple-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Truck className="h-4 sm:h-5 w-4 sm:w-5 text-purple-600" />
                    <span
                      className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                    >
                      {order.status.replace(/_/g, ' ').toUpperCase()}
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
                  {deliveryFee > 0 && (
                    <div className="text-xs text-gray-500">
                      {t('orders.inclDelivery')} {formatPrice(deliveryFee)}{' '}
                      {t('deliveryFee', { ns: 'common' }).toLowerCase()}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Address */}
              {order.delivery_address && (
                <div className="mb-3 text-sm text-purple-700 bg-purple-50 rounded px-3 py-2 flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2 flex-1">{order.delivery_address}</span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 text-purple-500 hover:text-purple-800 transition-colors"
                    title={t('delivery.openInMaps')}
                  >
                    <MapIcon className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}

              {/* Delivery Person */}
              {order.delivery_person?.full_name && (
                <div className="mb-3 text-sm text-gray-600 flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5" />
                  <span>
                    {t('delivery.driver')} {order.delivery_person.full_name}
                  </span>
                </div>
              )}

              {/* Order Items Preview */}
              <div className="mb-3 text-sm text-gray-600">
                {order.order_items?.slice(0, 3).map((item: any) => (
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
                {order.status === 'ready' && (
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => handleMarkOutForDelivery(order.id, order.delivery_person_id)}
                  >
                    <Truck className="h-4 w-4 mr-1" />
                    {t('delivery.outForDelivery')}
                  </Button>
                )}
                {order.status === 'out_for_delivery' && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleMarkDelivered(order.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('delivery.markDelivered')}
                  </Button>
                )}
                {['pending_approval', 'new', 'preparing', 'ready', 'out_for_delivery'].includes(
                  order.status,
                ) && (
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
                {t('delivery.cancelDeliveryOrder')}
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
                  {cancelOrderTarget.customer_name || t('delivery.title')}
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
