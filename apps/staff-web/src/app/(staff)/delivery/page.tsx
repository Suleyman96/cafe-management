'use client';

import { ORDER_STATUS } from '@cafe-idare/core';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import {
  CheckCircle,
  ChefHat,
  Clock,
  Loader2,
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
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CreateDeliveryModal } from '@/components/modals/create-delivery-modal';
import {
  formatPriceWithSettings,
  useCafeSettings,
  useCancelOrder,
  useDeliveryOrders,
  useMarkDelivered,
  useMarkOutForDelivery,
  useUpdateOrderStatus,
} from '@/hooks';
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
  const { data: orders, isLoading: loading, error, refetch } = useDeliveryOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  const markOutForDelivery = useMarkOutForDelivery();
  const markDelivered = useMarkDelivered();
  const cancelOrderMutation = useCancelOrder();
  const { data: cafeSettings } = useCafeSettings();

  const formatPrice = (amount: number) => {
    if (cafeSettings) {
      return formatPriceWithSettings(amount, cafeSettings);
    }
    return `$${amount.toFixed(2)}`;
  };

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
    if (order?.total) return order.total;
    if (!order?.order_items) return 0;
    return order.order_items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.item_price,
      0,
    );
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
      toast.success(`Order status updated to ${newStatus.replace(/_/g, ' ')}`);
    } catch (_error) {
      toast.error('Failed to update order status');
    }
  };

  const handleMarkOutForDelivery = async (orderId: string, deliveryPersonId?: string) => {
    if (!deliveryPersonId) {
      toast.error('Please assign a delivery person first');
      return;
    }
    try {
      await markOutForDelivery.mutateAsync({ orderId, deliveryPersonId });
      toast.success('Order is out for delivery');
    } catch (_error) {
      toast.error('Failed to update order');
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      await markDelivered.mutateAsync(orderId);
      toast.success('Order marked as delivered');
    } catch (_error) {
      toast.error('Failed to update order');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelOrderTarget || !cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    setCancelling(true);
    try {
      await cancelOrderMutation.mutateAsync({
        orderId: cancelOrderTarget.id,
        reason: cancelReason.trim(),
        tableId: null,
      });
      toast.success('Order cancelled');
      setShowCancelModal(false);
      setCancelOrderTarget(null);
      setCancelReason('');
      refetch();
    } catch (_error) {
      toast.error('Failed to cancel order');
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
        <p className="text-red-500">Error loading delivery orders: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-purple-600" />
          <h1 className="text-xl sm:text-2xl font-bold">Delivery Orders</h1>
          {activeCount > 0 && (
            <span className="bg-purple-100 text-purple-700 text-sm font-medium px-2.5 py-0.5 rounded-full">
              {activeCount} active
            </span>
          )}
        </div>
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Delivery Order</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by name, phone, address..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 border rounded-lg text-sm sm:text-base"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="new">New</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* No orders state */}
      {(!filteredOrders || filteredOrders.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          <Truck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">No delivery orders</p>
          <p className="text-sm mt-1">
            {statusFilter !== 'all'
              ? 'No orders match the selected filter'
              : 'Delivery orders will appear here when customers order via the delivery link'}
          </p>
        </div>
      )}

      {/* Orders List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredOrders?.map((order: any) => {
          const total = calculateOrderTotal(order);
          const deliveryFee = order.delivery_fee || 0;
          const grandTotal = total + deliveryFee;

          return (
            <div
              key={order.id}
              className="border border-purple-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
              onClick={() => (window.location.href = `/orders/${order.id}`)}
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
                      incl. {formatPrice(deliveryFee)} delivery
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Address */}
              {order.delivery_address && (
                <div className="mb-3 text-sm text-purple-700 bg-purple-50 rounded px-3 py-2 flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{order.delivery_address}</span>
                </div>
              )}

              {/* Delivery Person */}
              {order.delivery_person?.full_name && (
                <div className="mb-3 text-sm text-gray-600 flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5" />
                  <span>Driver: {order.delivery_person.full_name}</span>
                </div>
              )}

              {/* Order Items Preview */}
              <div className="mb-3 text-sm text-gray-600">
                {order.order_items?.slice(0, 3).map((item: any) => (
                  <div key={item.id}>
                    {item.quantity}x {item.menu_item?.name_en || item.item_name}
                    {item.notes && <span className="text-xs text-gray-500"> ({item.notes})</span>}
                  </div>
                ))}
                {order.order_items?.length > 3 && (
                  <div className="text-gray-400">+{order.order_items.length - 3} more items</div>
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
                    Approve
                  </Button>
                )}
                {order.status === 'new' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(order.id, 'preparing')}
                  >
                    <ChefHat className="h-4 w-4 mr-1" />
                    Start Preparing
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(order.id, 'ready')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Ready
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => handleMarkOutForDelivery(order.id, order.delivery_person_id)}
                  >
                    <Truck className="h-4 w-4 mr-1" />
                    Out for Delivery
                  </Button>
                )}
                {order.status === 'out_for_delivery' && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleMarkDelivered(order.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Mark Delivered
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
                    {order.status === 'pending_approval' ? 'Reject' : 'Cancel'}
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
              <h2 className="text-lg font-semibold text-red-600">Cancel Delivery Order</h2>
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
                <p className="font-medium">{cancelOrderTarget.customer_name || 'Delivery Order'}</p>
                <p className="text-sm text-gray-500">#{cancelOrderTarget.id.slice(0, 8)}</p>
              </div>
            )}

            <p className="text-gray-600 mb-4">
              Please provide a reason for cancelling this order. This action cannot be undone.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
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
                Keep Order
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
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <CreateDeliveryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(orderId) => {
          setIsCreateModalOpen(false);
          toast.success('Delivery order created');
          window.location.href = `/orders/${orderId}/add-items`;
        }}
      />
    </div>
  );
}
