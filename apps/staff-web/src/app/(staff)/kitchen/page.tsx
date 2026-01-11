'use client';

import { useState, useEffect } from 'react';
import { useOrders, useUpdateOrderStatus } from '@/hooks';
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
  User
} from 'lucide-react';

export default function KitchenDisplayPage() {
  const { data: orders, isLoading: loading, error, refetch } = useOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Filter orders for kitchen display (new, preparing, ready)
  const kitchenOrders = orders?.filter((order: any) => 
    ['new', 'preparing', 'ready'].includes(order.status)
  ).sort((a: any, b: any) => {
    // Sort by status priority (new > preparing > ready) then by time
    const statusPriority = { 'new': 0, 'preparing': 1, 'ready': 2 };
    const aPriority = statusPriority[a.status as keyof typeof statusPriority];
    const bPriority = statusPriority[b.status as keyof typeof statusPriority];
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

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

  // Get card color based on status and time
  const getCardColor = (status: string, minutes: number) => {
    if (status === 'ready') return 'bg-green-50 border-green-300';
    if (status === 'new') return 'bg-blue-50 border-blue-300 ring-2 ring-blue-400';
    if (minutes > 20) return 'bg-red-50 border-red-300';
    if (minutes > 15) return 'bg-orange-50 border-orange-300';
    return 'bg-yellow-50 border-yellow-300';
  };

  // Handle status update
  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus.mutateAsync({
        orderId,
        status: newStatus as any
      });
      // Don't show toast in kitchen view to avoid distractions
    } catch (error) {
      toast.error('Failed to update order');
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
    <div className="min-h-screen bg-gray-900 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">Kitchen Display</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`px-3 py-1 rounded ${audioEnabled ? 'bg-green-600' : 'bg-gray-600'} text-white text-sm`}
          >
            Sound: {audioEnabled ? 'ON' : 'OFF'}
          </button>
          <div className="text-white text-sm">
            Active Orders: {kitchenOrders?.length || 0}
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kitchenOrders?.map((order: any) => {
          const elapsedMinutes = calculateElapsedTime(order.created_at);
          const timeColor = getTimeColor(elapsedMinutes, order.status);
          const cardColor = getCardColor(order.status, elapsedMinutes);

          return (
            <div
              key={order.id}
              className={`border-2 rounded-lg p-4 ${cardColor} transition-all`}
            >
              {/* Order Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold">
                    {order.table ? `Table ${order.table.table_number}` : 'TAKEOUT'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Timer className={`h-4 w-4 ${timeColor}`} />
                    <span className={`font-medium ${timeColor}`}>
                      {elapsedMinutes} min
                    </span>
                    {order.source === 'phone' && (
                      <Package className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                </div>
                {order.status === 'new' && (
                  <AlertCircle className="h-6 w-6 text-blue-600 animate-pulse" />
                )}
                {order.status === 'preparing' && (
                  <ChefHat className="h-6 w-6 text-yellow-600" />
                )}
                {order.status === 'ready' && (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
              </div>

              {/* Customer Info for Takeout */}
              {order.source === 'phone' && order.customer_name && (
                <div className="mb-3 p-2 bg-white/50 rounded text-sm">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span className="font-medium">{order.customer_name}</span>
                  </div>
                  {order.customer_phone && (
                    <div className="text-xs text-gray-600">{order.customer_phone}</div>
                  )}
                </div>
              )}

              {/* Order Items */}
              <div className="space-y-2 mb-4">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="border-b border-gray-300 pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{item.quantity}x</span>
                      <span className="flex-1 mx-2">{item.menu_item?.name_en}</span>
                    </div>
                    {item.notes && (
                      <div className="mt-1 p-1 bg-red-100 rounded text-sm font-medium text-red-700">
                        📝 {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <div className="mt-auto">
                {order.status === 'new' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'preparing')}
                    className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded transition-colors"
                  >
                    Start Preparing
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'ready')}
                    className="w-full py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded transition-colors"
                  >
                    Mark Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <div className="w-full py-2 bg-green-600 text-white font-medium rounded text-center">
                    READY FOR PICKUP
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {(!kitchenOrders || kitchenOrders.length === 0) && (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center text-gray-400">
            <ChefHat className="h-16 w-16 mx-auto mb-4" />
            <p className="text-xl">No active orders</p>
          </div>
        </div>
      )}
    </div>
  );
}