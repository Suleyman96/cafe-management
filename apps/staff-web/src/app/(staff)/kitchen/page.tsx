'use client';

import { useTranslation } from '@gustri/i18n';
import { LoadingSpinner } from '@gustri/ui';
import {
  AlertCircle,
  CheckCircle,
  ChefHat,
  Package,
  Timer,
  User,
  Utensils,
  UtensilsCrossed,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useOrders, useUpdateOrderItemStatus, useUpdateOrderStatus } from '@/hooks';
import { supabase } from '@/lib/supabase/client';

export default function KitchenDisplayPage() {
  const { t } = useTranslation('staff');
  const { data: orders, isLoading: loading, error, refetch } = useOrders();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const [_currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute to refresh elapsed times
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check if all non-cancelled items in an order are served
  const allItemsServed = (order: any) => {
    const items = order.order_items?.filter((item: any) => item.status !== 'cancelled') || [];
    if (items.length === 0) return false;
    return items.every((item: any) => item.status === 'served');
  };

  // Check if all non-cancelled items in an order are ready (or served)
  const allItemsReady = (order: any) => {
    const items = order.order_items?.filter((item: any) => item.status !== 'cancelled') || [];
    if (items.length === 0) return false;
    return items.every((item: any) => item.status === 'ready' || item.status === 'served');
  };

  // Filter orders for kitchen display (new, preparing, ready) - exclude orders where all items are served
  const kitchenOrders = orders
    ?.filter(
      (order: any) =>
        ['new', 'preparing', 'ready'].includes(order.status) && !allItemsServed(order),
    )
    .sort((a: any, b: any) => {
      // Sort by status priority (new > preparing > ready) then by time
      const statusPriority = { 'new': 0, preparing: 1, ready: 2 };
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
    if (status === 'new')
      return 'bg-blue-100 border-blue-400 ring-4 ring-blue-500/50 shadow-blue-200';
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
      case 'new':
        return t('kitchen.newStatus');
      case 'preparing':
        return t('kitchen.cookingStatus');
      case 'ready':
        return t('kitchen.readyStatus');
      default:
        return status.toUpperCase();
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-600 text-white';
      case 'preparing':
        return 'bg-yellow-500 text-black';
      case 'ready':
        return 'bg-green-600 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Handle status update — also updates all item statuses to stay in sync
  const handleStatusUpdate = async (
    orderId: string,
    newStatus: 'PREPARING' | 'READY' | 'SERVED',
  ) => {
    try {
      const order = kitchenOrders?.find((o: any) => o.id === orderId);

      // Update all item statuses to match the order-level action
      if (order?.order_items) {
        const targetItemStatus =
          newStatus === 'PREPARING' ? 'preparing' : newStatus === 'READY' ? 'ready' : 'served';

        for (const item of order.order_items) {
          // Skip items that are already at or past the target status, and skip cancelled
          if (item.status === 'cancelled' || item.status === targetItemStatus) continue;
          if (targetItemStatus === 'preparing' && item.status !== 'pending') continue;
          if (
            targetItemStatus === 'ready' &&
            item.status !== 'pending' &&
            item.status !== 'preparing'
          )
            continue;

          await updateItemStatus.mutateAsync({
            itemId: item.id,
            status: targetItemStatus as 'pending' | 'preparing' | 'ready' | 'served',
          });
        }
      }

      await updateOrderStatus.mutateAsync({
        orderId,
        status: newStatus,
      });
      // Don't show toast in kitchen view to avoid distractions
    } catch (_error) {
      toast.error(t('orders.failedUpdateStatus'));
    }
  };

  // Get item status style for kitchen
  const getItemStatusStyle = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-300',
          text: 'text-gray-700',
          icon: <AlertCircle className="h-4 w-4" />,
          label: t('pending', { ns: 'common' }),
        };
      case 'preparing':
        return {
          bg: 'bg-yellow-100',
          border: 'border-yellow-400',
          text: 'text-yellow-800',
          icon: <ChefHat className="h-4 w-4" />,
          label: t('kitchen.cooking'),
        };
      case 'ready':
        return {
          bg: 'bg-green-100',
          border: 'border-green-400',
          text: 'text-green-800',
          icon: <CheckCircle className="h-4 w-4" />,
          label: t('orders.ready'),
        };
      case 'served':
        return {
          bg: 'bg-purple-100',
          border: 'border-purple-400',
          text: 'text-purple-800',
          icon: <UtensilsCrossed className="h-4 w-4" />,
          label: t('orders.served'),
        };
      default:
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-300',
          text: 'text-gray-700',
          icon: null,
          label: status,
        };
    }
  };

  // Handle item status update - also auto-update order status if needed
  const handleItemStatusUpdate = async (itemId: string, newStatus: string, order: any) => {
    try {
      // If order is still "new", automatically change to "preparing"
      if (order.status === 'new') {
        await updateOrderStatus.mutateAsync({
          orderId: order.id,
          status: 'PREPARING',
        });
      }

      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
      });

      // Check if all items will be ready after this update
      if (newStatus === 'ready' && order.status === 'preparing') {
        const otherItems =
          order.order_items?.filter(
            (item: any) => item.id !== itemId && item.status !== 'cancelled',
          ) || [];
        const allOthersReady = otherItems.every(
          (item: any) => item.status === 'ready' || item.status === 'served',
        );

        // If all other items are ready/served, update order status to ready
        if (allOthersReady) {
          await updateOrderStatus.mutateAsync({
            orderId: order.id,
            status: 'READY',
          });
        }
      }

      // Check if all items will be served after this update
      if (newStatus === 'served' && order.status === 'ready') {
        const otherItems =
          order.order_items?.filter(
            (item: any) => item.id !== itemId && item.status !== 'cancelled',
          ) || [];
        const allOthersServed = otherItems.every((item: any) => item.status === 'served');

        // If all other items are served, update order status to served
        if (allOthersServed) {
          await updateOrderStatus.mutateAsync({
            orderId: order.id,
            status: 'SERVED',
          });
        }
      }

      // No toast for kitchen - faster feedback via visual change
    } catch (_error) {
      toast.error(t('orders.failedUpdateStatus'));
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
        <p className="text-red-500">{t('error', { ns: 'common' })}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Utensils className="h-6 sm:h-10 w-6 sm:w-10 text-white" />
          <h1 className="text-xl sm:text-3xl font-bold text-white">{t('kitchen.title')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-6">
          {/* Status Summary */}
          <div className="flex gap-2 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 bg-blue-600 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg">
              <AlertCircle className="h-4 sm:h-6 w-4 sm:w-6 text-white" />
              <span className="text-white font-bold text-base sm:text-xl">{newOrdersCount}</span>
              <span className="text-blue-200 text-xs sm:text-sm hidden xs:inline">
                {t('kitchen.newOrders')}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 bg-yellow-500 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg">
              <ChefHat className="h-4 sm:h-6 w-4 sm:w-6 text-black" />
              <span className="text-black font-bold text-base sm:text-xl">{preparingCount}</span>
              <span className="text-yellow-800 text-xs sm:text-sm hidden xs:inline">
                {t('kitchen.cooking')}
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 bg-green-600 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg">
              <CheckCircle className="h-4 sm:h-6 w-4 sm:w-6 text-white" />
              <span className="text-white font-bold text-base sm:text-xl">{readyCount}</span>
              <span className="text-green-200 text-xs sm:text-sm hidden xs:inline">
                {t('kitchen.readyLabel')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {kitchenOrders?.map((order: any) => {
          const elapsedMinutes = calculateElapsedTime(order.created_at);
          const timeColor = getTimeColor(elapsedMinutes, order.status);
          const cardColor = getCardColor(order, elapsedMinutes);

          return (
            <div
              key={order.id}
              className={`border-2 sm:border-4 rounded-xl p-3 sm:p-5 ${cardColor} transition-all shadow-lg ${
                order.status === 'new' ? 'animate-pulse' : ''
              }`}
            >
              {/* Order Header with Order Number */}
              <div className="flex justify-between items-start mb-2 sm:mb-4">
                <div>
                  {/* Order Number - Large and prominent */}
                  <div className="text-2xl sm:text-3xl font-black text-gray-800 mb-1">
                    #{getOrderNumber(order.id)}
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-gray-700">
                    {order.table ? (
                      order.table.table_number
                    ) : (
                      <span className="flex items-center gap-1 sm:gap-2 text-orange-700">
                        <Package className="h-4 sm:h-5 w-4 sm:w-5" />
                        {t('tables.takeout').toUpperCase()}
                      </span>
                    )}
                  </h3>
                </div>
                {/* Status Badge */}
                <div
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold ${getStatusBadgeColor(order.status)}`}
                >
                  {getStatusLabel(order.status)}
                </div>
              </div>

              {/* Timer - Compact */}
              <div
                className={`flex items-center gap-1 sm:gap-2 mb-2 sm:mb-3 px-2 py-1 sm:py-1.5 rounded-lg ${
                  elapsedMinutes > 20
                    ? 'bg-red-200'
                    : elapsedMinutes > 15
                      ? 'bg-orange-200'
                      : elapsedMinutes > 10
                        ? 'bg-yellow-200'
                        : 'bg-white/60'
                }`}
              >
                <Timer className={`h-4 sm:h-5 w-4 sm:w-5 ${timeColor}`} />
                <span className={`text-lg sm:text-xl font-bold ${timeColor}`}>
                  {elapsedMinutes}
                </span>
                <span className={`text-xs sm:text-sm ${timeColor}`}>{t('kitchen.min')}</span>
                {elapsedMinutes > 15 && (
                  <span className="ml-auto text-red-600 text-xs sm:text-sm font-bold animate-pulse">
                    {t('kitchen.urgent')}
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

              {/* Order Notes */}
              {order.customer_notes && (
                <div className="mb-3 p-2 bg-red-200 rounded-lg border-2 border-red-400">
                  <p className="text-sm font-bold text-red-800">
                    📝 {t('kitchen.orderNotes')} {order.customer_notes}
                  </p>
                </div>
              )}

              {/* Order Items - Background color indicates status */}
              <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
                {order.order_items
                  ?.filter((item: any) => item.status !== 'cancelled')
                  .map((item: any) => {
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
                            {item.menu_item?.name}
                          </span>
                          {/* Action Buttons for Item */}
                          <div className="flex-shrink-0">
                            {(item.status === 'pending' || item.status === 'preparing') && (
                              <button
                                onClick={() => handleItemStatusUpdate(item.id, 'ready', order)}
                                className="px-1.5 py-0.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-bold rounded transition-colors shadow flex items-center gap-0.5"
                              >
                                <CheckCircle className="h-3 w-3" />
                                {t('orders.ready')}
                              </button>
                            )}
                            {item.status === 'ready' && (
                              <button
                                onClick={() => handleItemStatusUpdate(item.id, 'served', order)}
                                className="px-1.5 py-0.5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white text-xs font-bold rounded transition-colors shadow flex items-center gap-0.5"
                              >
                                <UtensilsCrossed className="h-3 w-3" />
                                {t('orders.served')}
                              </button>
                            )}
                            {item.status === 'served' && (
                              <CheckCircle className="h-4 w-4 text-purple-600" />
                            )}
                          </div>
                        </div>
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
                    {t('kitchen.startCooking')}
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'READY')}
                    className="w-full py-2.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    {t('kitchen.allItemsReady')}
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    onClick={() => handleStatusUpdate(order.id, 'SERVED')}
                    className="w-full py-2.5 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white text-base font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <UtensilsCrossed className="h-5 w-5" />
                    {t('kitchen.allServed')}
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
            <p className="text-4xl font-bold text-gray-400 mb-2">{t('kitchen.noActiveOrders')}</p>
            <p className="text-xl text-gray-500">{t('kitchen.waitingForOrders')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
