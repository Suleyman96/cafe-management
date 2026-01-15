'use client';

import { useState, useEffect } from 'react';
import { useOrders, useUpdateOrderStatus, useUpdateOrderItemStatus } from '@/hooks';
import { LoadingSpinner } from '@cafe-idare/ui';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  ChefHat,
  Timer,
  User,
  Bell,
  Utensils,
  UtensilsCrossed
} from 'lucide-react';

export default function KitchenDisplayPage() {
  const { data: orders, isLoading: loading, error, refetch } = useOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute to refresh elapsed times
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check if all items in an order are served
  const allItemsServed = (order: any) => {
    if (!order.order_items || order.order_items.length === 0) return false;
    return order.order_items.every((item: any) => item.status === 'served');
  };

  // Check if all items in an order are ready (or served)
  const allItemsReady = (order: any) => {
    if (!order.order_items || order.order_items.length === 0) return false;
    return order.order_items.every((item: any) => item.status === 'ready' || item.status === 'served');
  };

  // Filter orders for kitchen display (new, preparing, ready) - exclude orders where all items are served
  const kitchenOrders = orders?.filter((order: any) =>
    ['new', 'preparing', 'ready'].includes(order.status) && !allItemsServed(order)
  ).sort((a: any, b: any) => {
    // Sort by status priority (new > preparing > ready) then by time
    const statusPriority = { 'new': 0, 'preparing': 1, 'ready': 2 };
    const aPriority = statusPriority[a.status as keyof typeof statusPriority];
    const bPriority = statusPriority[b.status as keyof typeof statusPriority];
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Count orders by status
  const newOrdersCount = kitchenOrders?.filter((o: any) => o.status === 'new').length || 0;
  const preparingCount = kitchenOrders?.filter((o: any) => o.status === 'preparing').length || 0;
  const readyCount = kitchenOrders?.filter((o: any) => o.status === 'ready').length || 0;

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('kitchen-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          refetch();
          // Play sound for new orders
          if (payload.eventType === 'INSERT' && audioEnabled) {
            playNotificationSound();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, audioEnabled]);

  // Play notification sound
  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.play().catch(() => {
      // Ignore errors if audio can't play
    });
  };

  // Calculate elapsed time
  const calculateElapsedTime = (createdAt: string) => {
    const start = new Date(createdAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
    return diffMinutes;
  };

  // Get time color based on elapsed time
  const getTimeColor = (minutes: number, status: string) => {
    if (status === 'ready') return 'text-green-600';
    if (minutes > 20) return 'text-red-600';
    if (minutes > 15) return 'text-orange-600';
    if (minutes > 10) return 'text-yellow-600';
    return 'text-gray-600';
  };

  // Get card color based on status, time, and item statuses
  const getCardColor = (order: any, minutes: number) => {
    const status = order.status;
    // If all items are ready, show green regardless of order status
    if (allItemsReady(order)) return 'bg-green-50 border-green-400 shadow-green-200';
    if (status === 'ready') return 'bg-green-50 border-green-400 shadow-green-200';
    if (status === 'new') return 'bg-blue-100 border-blue-400 ring-4 ring-blue-500/50 shadow-blue-200';
    if (minutes > 20) return 'bg-red-100 border-red-400 shadow-red-200';
    if (minutes > 15) return 'bg-orange-100 border-orange-400 shadow-orange-200';
    return 'bg-yellow-50 border-yellow-400 shadow-yellow-200';
  };

  // Get order number from ID (last 4 characters)
  const getOrderNumber = (orderId: string) => {
    return orderId.slice(-4).toUpperCase();
  };

  // Get status label
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'NEW ORDER';
      case 'preparing': return 'COOKING';
      case 'ready': return 'READY';
      default: return status.toUpperCase();
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-600 text-white';
      case 'preparing': return 'bg-yellow-500 text-black';
      case 'ready': return 'bg-green-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  // Handle status update
  const handleStatusUpdate = async (orderId: string, newStatus: 'PREPARING' | 'READY' | 'SERVED') => {
    try {
      await updateOrderStatus.mutateAsync({
        orderId,
        status: newStatus
      });
      // Don't show toast in kitchen view to avoid distractions
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  // Get item status style for kitchen
  const getItemStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700', icon: <AlertCircle className="h-4 w-4" />, label: 'Pending' };
      case 'preparing':
        return { bg: 'bg-yellow-100', border: 'border-yellow-400', text: 'text-yellow-800', icon: <ChefHat className="h-4 w-4" />, label: 'Cooking' };
      case 'ready':
        return { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-800', icon: <CheckCircle className="h-4 w-4" />, label: 'Ready' };
      case 'served':
        return { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-800', icon: <UtensilsCrossed className="h-4 w-4" />, label: 'Served' };
      default:
        return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700', icon: null, label: status };
    }
  };

  // Handle item status update - also auto-update order status if needed
  const handleItemStatusUpdate = async (itemId: string, newStatus: string, order: any) => {
    try {
      // If order is still "new", automatically change to "preparing"
      if (order.status === 'new') {
        await updateOrderStatus.mutateAsync({
          orderId: order.id,
          status: 'PREPARING'
        });
      }

      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served'
      });

      // Check if all items will be ready after this update
      if (newStatus === 'ready' && order.status === 'preparing') {
        const otherItems = order.order_items?.filter((item: any) => item.id !== itemId) || [];
        const allOthersReady = otherItems.every((item: any) => item.status === 'ready' || item.status === 'served');

        // If all other items are ready/served, update order status to ready
        if (allOthersReady) {
          await updateOrderStatus.mutateAsync({
            orderId: order.id,
            status: 'READY'
          });
        }
      }

      // Check if all items will be served after this update
      if (newStatus === 'served' && order.status === 'ready') {
        const otherItems = order.order_items?.filter((item: any) => item.id !== itemId) || [];
        const allOthersServed = otherItems.every((item: any) => item.status === 'served');

        // If all other items are served, update order status to served
        if (allOthersServed) {
          await updateOrderStatus.mutateAsync({
            orderId: order.id,
            status: 'SERVED'
          });
        }
      }

      // No toast for kitchen - faster feedback via visual change
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <p className="text-red-500">Error loading orders</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Utensils className="h-10 w-10 text-white" />
          <h1 className="text-3xl font-bold text-white">Kitchen Display</h1>
        </div>
        <div className="flex items-center gap-6">
          {/* Status Summary */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg">
              <AlertCircle className="h-6 w-6 text-white" />
              <span className="text-white font-bold text-xl">{newOrdersCount}</span>
              <span className="text-blue-200 text-sm">NEW</span>
            </div>
            <div className="flex items-center gap-2 bg-yellow-500 px-4 py-2 rounded-lg">
              <ChefHat className="h-6 w-6 text-black" />
              <span className="text-black font-bold text-xl">{preparingCount}</span>
              <span className="text-yellow-800 text-sm">COOKING</span>
            </div>
            <div className="flex items-center gap-2 bg-green-600 px-4 py-2 rounded-lg">
              <CheckCircle className="h-6 w-6 text-white" />
              <span className="text-white font-bold text-xl">{readyCount}</span>
              <span className="text-green-200 text-sm">READY</span>
            </div>
          </div>
          {/* Sound Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-medium transition-colors ${
              audioEnabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
            }`}
          >
            <Bell className={`h-5 w-5 ${audioEnabled ? 'animate-pulse' : ''}`} />
            {audioEnabled ? 'Sound ON' : 'Sound OFF'}
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {kitchenOrders?.map((order: any) => {
          const elapsedMinutes = calculateElapsedTime(order.created_at);
          const timeColor = getTimeColor(elapsedMinutes, order.status);
          const cardColor = getCardColor(order, elapsedMinutes);

          return (
            <div
              key={order.id}
              className={`border-4 rounded-xl p-5 ${cardColor} transition-all shadow-lg ${
                order.status === 'new' ? 'animate-pulse' : ''
              }`}
            >
              {/* Order Header with Order Number */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  {/* Order Number - Large and prominent */}
                  <div className="text-3xl font-black text-gray-800 mb-1">
                    #{getOrderNumber(order.id)}
                  </div>
                  <h3 className="text-xl font-bold text-gray-700">
                    {order.table ? `Table ${order.table.table_number}` : (
                      <span className="flex items-center gap-2 text-orange-700">
                        <Package className="h-5 w-5" />
                        TAKEOUT
                      </span>
                    )}
                  </h3>
                </div>
                {/* Status Badge */}
                <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${getStatusBadgeColor(order.status)}`}>
                  {getStatusLabel(order.status)}
                </div>
              </div>

              {/* Timer - Compact */}
              <div className={`flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg ${
                elapsedMinutes > 20 ? 'bg-red-200' :
                elapsedMinutes > 15 ? 'bg-orange-200' :
                elapsedMinutes > 10 ? 'bg-yellow-200' :
                'bg-white/60'
              }`}>
                <Timer className={`h-5 w-5 ${timeColor}`} />
                <span className={`text-xl font-bold ${timeColor}`}>
                  {elapsedMinutes}
                </span>
                <span className={`text-sm ${timeColor}`}>min</span>
                {elapsedMinutes > 15 && (
                  <span className="ml-auto text-red-600 text-sm font-bold animate-pulse">
                    URGENT!
                  </span>
                )}
              </div>

              {/* Customer Info for Takeout */}
              {order.source === 'phone' && order.customer_name && (
                <div className="mb-4 p-3 bg-orange-100 rounded-lg border-2 border-orange-300">
                  <div className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-orange-700" />
                    <span className="font-bold text-orange-800">{order.customer_name}</span>
                  </div>
                  {order.customer_phone && (
                    <div className="text-base text-orange-700 mt-1">{order.customer_phone}</div>
                  )}
                </div>
              )}

              {/* Order Items - Background color indicates status */}
              <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
                {order.order_items?.map((item: any) => {
                  const itemStyle = getItemStatusStyle(item.status);

                  return (
                    <div
                      key={item.id}
                      className={`rounded p-1.5 border ${itemStyle.bg} ${itemStyle.border} transition-all`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-gray-800 bg-white/80 px-1.5 py-0.5 rounded flex-shrink-0">
                          {item.quantity}x
                        </span>
                        <span className="flex-1 text-sm font-semibold text-gray-800 min-w-0">
                          {item.menu_item?.name_en}
                        </span>
                        {/* Action Buttons for Item */}
                        <div className="flex-shrink-0">
                          {(item.status === 'pending' || item.status === 'preparing') && (
                            <button
                              onClick={() => handleItemStatusUpdate(item.id, 'ready', order)}
                              className="px-1.5 py-0.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-bold rounded transition-colors shadow flex items-center gap-0.5"
                            >
                              <CheckCircle className="h-3 w-3" />
                              Ready
                            </button>
                          )}
                          {item.status === 'ready' && (
                            <button
                              onClick={() => handleItemStatusUpdate(item.id, 'served', order)}
                              className="px-1.5 py-0.5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white text-xs font-bold rounded transition-colors shadow flex items-center gap-0.5"
                            >
                              <UtensilsCrossed className="h-3 w-3" />
                              Served
                            </button>
                          )}
                          {item.status === 'served' && (
                            <CheckCircle className="h-4 w-4 text-purple-600" />
                          )}
                        </div>
                      </div>
                      {item.notes && (
                        <div className="mt-1 p-1 bg-red-200 rounded text-xs font-bold text-red-800 border border-red-400">
                          NOTE: {item.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Button - Compact touch target */}
              <div className="mt-auto">
                {order.status === 'new' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'PREPARING')}
                    className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-black text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <ChefHat className="h-5 w-5" />
                    START COOKING
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'READY')}
                    className="w-full py-2.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    ALL ITEMS READY
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'SERVED')}
                    className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <UtensilsCrossed className="h-5 w-5" />
                    ALL SERVED
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {(!kitchenOrders || kitchenOrders.length === 0) && (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <ChefHat className="h-32 w-32 mx-auto mb-6 text-gray-500" />
            <p className="text-4xl font-bold text-gray-400 mb-2">No Active Orders</p>
            <p className="text-xl text-gray-500">Waiting for new orders...</p>
          </div>
        </div>
      )}
    </div>
  );
}