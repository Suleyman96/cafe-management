'use client';

import { useState, useEffect } from 'react';
import { useOrders, useUpdateOrderStatus } from '@/hooks';
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
  Package
} from 'lucide-react';

type OrderStatus = 'new' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
type OrderSource = 'customer' | 'waiter' | 'phone';

export default function OrdersPage() {
  const { data: orders, isLoading: loading, error, refetch } = useOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<OrderSource | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTableFilter, setSelectedTableFilter] = useState<string>('all');

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

  // Calculate order total
  const calculateOrderTotal = (order: any) => {
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
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Order Management</h1>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search orders..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            className="px-3 py-2 border rounded-lg"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="served">Served</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            className="px-3 py-2 border rounded-lg"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
          >
            <option value="all">All Sources</option>
            <option value="customer">Customer</option>
            <option value="waiter">Waiter</option>
            <option value="phone">Takeout</option>
          </select>

          {selectedTableFilter !== 'all' && (
            <Button
              variant="outline"
              onClick={() => setSelectedTableFilter('all')}
            >
              Clear Table Filter (Table {selectedTableFilter})
            </Button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders?.map((order: any) => {
          const total = calculateOrderTotal(order);
          const paid = calculatePaidAmount(order);
          const remaining = total - paid;
          const isFullyPaid = remaining === 0 && total > 0;

          const isTakeout = !order.table;

          return (
            <div
              key={order.id}
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                isTakeout
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-200 bg-white'
              }`}
              onClick={() => window.location.href = `/orders/${order.id}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-3">
                    {isTakeout ? (
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-orange-600" />
                        <h3 className="font-semibold text-lg text-orange-800">Takeout Order</h3>
                      </div>
                    ) : (
                      <h3 className="font-semibold text-lg">Table {order.table.table_number}</h3>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
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
                        {order.assigned_waiter.full_name}
                      </span>
                    )}
                    <span className="text-xs">
                      #{order.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-semibold">
                    ${total.toFixed(2)}
                  </div>
                  {paid > 0 && (
                    <div className="text-sm text-green-600">
                      Paid: ${paid.toFixed(2)}
                    </div>
                  )}
                  {remaining > 0 && paid > 0 && (
                    <div className="text-sm text-orange-600">
                      Remaining: ${remaining.toFixed(2)}
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
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
                    Mark Ready
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
                    Mark Served
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
                    Process Payment
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
                    Process Payment
                  </Button>
                )}
                {['new', 'preparing'].includes(order.status) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Cancel
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
    </div>
  );
}