'use client';

import { useState, useEffect } from 'react';
import { useOrders, useUpdateOrderStatus, useCancelOrder, useCafeSettings, formatPriceWithSettings } from '@/hooks';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { ORDER_STATUS } from '@cafe-idare/core';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Clock,
  DollarSign,
  User,
  UserCheck,
  ChefHat,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  CreditCard,
  Package,
  X,
  Loader2,
  ThumbsUp,
  Smartphone
} from 'lucide-react';

type OrderStatus = 'pending_approval' | 'new' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
type OrderSource = 'customer' | 'waiter' | 'phone';

export default function OrdersPage() {
  const { data: orders, isLoading: loading, error, refetch } = useOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  const cancelOrderMutation = useCancelOrder();
  const { data: cafeSettings } = useCafeSettings();

  // Format price using cafe settings or fallback
  const formatPrice = (amount: number) => {
    if (cafeSettings) {
      return formatPriceWithSettings(amount, cafeSettings);
    }
    return `$${amount.toFixed(2)}`;
  };

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<OrderSource | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderTarget, setCancelOrderTarget] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Get table filter from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableNumber = params.get('table');
    if (tableNumber) {
      setSelectedTableFilter(tableNumber);
    }
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          refetch();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          refetch();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_payments' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Get order total from database (includes tax) for consistency
  // Fall back to calculating from items if total is not set
  const calculateOrderTotal = (order: any) => {
    if (order?.total) return order.total;
    if (!order?.order_items) return 0;
    return order.order_items.reduce((sum: number, item: any) =>
      sum + (item.quantity * item.item_price), 0
    );
  };

  // Calculate paid amount
  const calculatePaidAmount = (order: any) => {
    if (!order?.order_payments) return 0;
    return order.order_payments.reduce((sum: number, payment: any) => 
      sum + payment.amount, 0
    );
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color
  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending_approval':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'served':
        return 'bg-purple-100 text-purple-800';
      case 'paid':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle status update
  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const statusKey = Object.entries(ORDER_STATUS).find(([_, value]) => value === newStatus)?.[0];
      if (!statusKey) throw new Error('Invalid status');

      await updateOrderStatus.mutateAsync({
        orderId,
        status: statusKey as keyof typeof ORDER_STATUS
      });
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  // Handle cancel order with reason
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
        tableId: cancelOrderTarget.table_id
      });
      toast.success('Order cancelled');
      setShowCancelModal(false);
      setCancelOrderTarget(null);
      setCancelReason('');
      refetch();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error('Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  // Open cancel modal
  const openCancelModal = (order: any) => {
    setCancelOrderTarget(order);
    setShowCancelModal(true);
  };

  // Filter orders
  const filteredOrders = orders?.filter((order: any) => {
    if (statusFilter !== 'all' && order.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && order.source !== sourceFilter) return false;
    if (selectedTableFilter !== 'all' && order.table?.table_number !== parseInt(selectedTableFilter)) return false;
    if (searchTerm && !order.id.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !order.table?.table_number.toString().includes(searchTerm)) return false;
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
        <p className="text-red-500">Error loading orders: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Order Management</h1>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search orders..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 sm:gap-4">
            <select
              className="flex-1 sm:flex-none px-3 py-2 border rounded-lg text-sm sm:text-base"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Status</option>
              <option value="pending_approval">⏳ Pending Approval</option>
              <option value="new">New</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="served">Served</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="flex-1 sm:flex-none px-3 py-2 border rounded-lg text-sm sm:text-base"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
            >
              <option value="all">All Sources</option>
              <option value="customer">Customer</option>
              <option value="waiter">Waiter</option>
              <option value="phone">Takeout</option>
            </select>
          </div>

          {selectedTableFilter !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTableFilter('all')}
              className="w-full sm:w-auto"
            >
              Clear Table Filter (Table {selectedTableFilter})
            </Button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredOrders?.map((order: any) => {
          const total = calculateOrderTotal(order);
          const paid = calculatePaidAmount(order);
          const remaining = total - paid;
          const isFullyPaid = remaining === 0 && total > 0;

          const isTakeout = !order.table;

          return (
            <div
              key={order.id}
              className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer ${
                isTakeout
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
              onClick={() => window.location.href = `/orders/${order.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-3">
                <div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {isTakeout ? (
                      <div className="flex items-center gap-2">
                        <Package className="h-4 sm:h-5 w-4 sm:w-5 text-orange-600" />
                        <h3 className="font-semibold text-base sm:text-lg text-orange-800">Takeout</h3>
                      </div>
                    ) : (
                      <h3 className="font-semibold text-base sm:text-lg">Table {order.table.table_number}</h3>
                    )}
                    <span className={`px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs sm:text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(order.created_at)}
                    </span>
                    {order.customer_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {order.customer_name}
                      </span>
                    )}
                    {order.assigned_waiter && (
                      <span className="flex items-center gap-1 text-green-600">
                        <UserCheck className="h-3 w-3" />
                        <span className="hidden sm:inline">{order.assigned_waiter.full_name}</span>
                        <span className="sm:hidden">{order.assigned_waiter.full_name.split(' ')[0]}</span>
                      </span>
                    )}
                    <span className="text-xs hidden sm:inline">
                      #{order.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right flex sm:block items-center gap-3 sm:gap-0">
                  <div className="text-base sm:text-lg font-semibold">
                    {formatPrice(total)}
                  </div>
                  {paid > 0 && (
                    <div className="text-xs sm:text-sm text-green-600">
                      Paid: {formatPrice(paid)}
                    </div>
                  )}
                  {remaining > 0 && paid > 0 && (
                    <div className="text-xs sm:text-sm text-orange-600">
                      Due: {formatPrice(remaining)}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items Preview */}
              <div className="mb-3 text-sm text-gray-600">
                {order.order_items?.slice(0, 3).map((item: any, index: number) => (
                  <div key={item.id}>
                    {item.quantity}x {item.menu_item?.name_en}
                    {item.notes && <span className="text-xs text-gray-500"> ({item.notes})</span>}
                  </div>
                ))}
                {order.order_items?.length > 3 && (
                  <div className="text-gray-400">
                    +{order.order_items.length - 3} more items
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Pending Approval: Show approve button */}
                {order.status === 'pending_approval' && (
                  <>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleStatusUpdate(order.id, 'new')}
                    >
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    {order.source === 'customer' && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                        <Smartphone className="h-3 w-3" />
                        QR Order
                      </span>
                    )}
                  </>
                )}
                {order.status === 'new' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(order.id, 'preparing')}
                  >
                    <ChefHat className="h-4 w-4 mr-1" />
                    <span className="hidden xs:inline">Start </span>Preparing
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
                {/* Dine-in orders: Mark as served before payment */}
                {order.status === 'ready' && order.table && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(order.id, 'served')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Served
                  </Button>
                )}
                {/* Takeout orders: Mark as picked up (completes the order) */}
                {order.status === 'ready' && !order.table && !isFullyPaid && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsPaymentModalOpen(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    Payment
                  </Button>
                )}
                {/* Dine-in served orders: Process payment */}
                {order.status === 'served' && !isFullyPaid && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsPaymentModalOpen(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-1" />
                    Payment
                  </Button>
                )}
                {['pending_approval', 'new', 'preparing', 'ready', 'served'].includes(order.status) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openCancelModal(order)}
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
            toast.success('Payment processed successfully');
            refetch();
          }}
        />
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-600">Cancel Order</h2>
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
                  {cancelOrderTarget.table
                    ? `Table ${cancelOrderTarget.table.table_number}`
                    : 'Takeout Order'}
                </p>
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
                autoFocus
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
    </div>
  );
}