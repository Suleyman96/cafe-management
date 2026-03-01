'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  Check,
  CheckCircle,
  ChefHat,
  Clock,
  CreditCard,
  DollarSign,
  Layers,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Smartphone,
  ThumbsUp,
  UserCheck,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ItemTransferModal } from '@/components/modals/item-transfer-modal';
import {
  formatPriceWithSettings,
  useAddOrderItems,
  useCafeSettings,
  useCancelOrder,
  useCancelOrderItem,
  useCategories,
  useCreateOrder,
  useMenuItems,
  useOrders,
  useTable,
  useUpdateOrderItemStatus,
  useUpdateOrderStatus,
} from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase/client';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
};

export default function TableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.id as string;
  const { staff: currentStaff } = useAuth();
  const { t } = useTranslation('staff');

  const { data: table, isLoading: tableLoading } = useTable(tableId);
  const { data: orders, refetch: refetchOrders } = useOrders();
  const { data: menuItems, isLoading: menuLoading } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();

  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const cancelOrder = useCancelOrder();
  const cancelOrderItem = useCancelOrderItem();
  const { data: cafeSettings } = useCafeSettings();

  // Format price using cafe settings or fallback
  const formatPrice = (amount: number) => {
    if (cafeSettings) {
      return formatPriceWithSettings(amount, cafeSettings);
    }
    return `$${amount.toFixed(2)}`;
  };

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedOrderIndex, setSelectedOrderIndex] = useState(0);
  const [cancelItemConfirm, setCancelItemConfirm] = useState<OrderItem | null>(null);
  const [cancelItemQty, setCancelItemQty] = useState(1);
  const [cancellingItem, setCancellingItem] = useState(false);
  const [showItemTransferModal, setShowItemTransferModal] = useState(false);

  // Get ALL active orders for this table (including pending_approval)
  const activeOrders = useMemo(() => {
    return (
      orders?.filter(
        (order: any) =>
          order.table_id === tableId &&
          ['pending_approval', 'new', 'preparing', 'ready', 'served'].includes(order.status),
      ) || []
    );
  }, [orders, tableId]);

  // Get currently selected order
  const activeOrder = activeOrders[selectedOrderIndex] || activeOrders[0];

  // Reset selected order index when orders change
  useEffect(() => {
    if (selectedOrderIndex >= activeOrders.length && activeOrders.length > 0) {
      setSelectedOrderIndex(0);
    }
  }, [activeOrders.length, selectedOrderIndex]);

  // Reset selected order when tableId changes (navigating to a different table)
  useEffect(() => {
    setSelectedOrderIndex(0);
  }, []);

  // Create order with items (for new orders on free tables)
  const handleCreateOrderWithItems = async () => {
    if (cart.length === 0) {
      toast.error(t('orders.addAtLeastOneItem'));
      return;
    }

    setSubmitting(true);
    try {
      // First create the order
      const newOrder = await createOrder.mutateAsync({
        table_id: tableId,
        order_type: 'dine_in',
        status: 'new',
        assigned_waiter_id: currentStaff?.id || null,
        customer_notes: orderNotes.trim() || null,
      } as any);

      // Then add the items
      const orderItems = cart.map((item) => ({
        order_id: newOrder.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        quantity: item.quantity,
        item_price: item.menuItem.price,
        notes: null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);
      toast.success(t('orders.orderCreatedSuccess'));
      setCart([]);
      setOrderNotes('');
      refetchOrders();
    } catch (error: any) {
      console.error('Failed to create order:', error);
      toast.error(t('orders.failedCreateOrder'));
    } finally {
      setSubmitting(false);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`table-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        refetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, refetchOrders]);

  // Filter menu items by category
  const filteredItems = selectedCategory
    ? menuItems?.filter((item: MenuItem) => item.category_id === selectedCategory)
    : menuItems;

  // Add item to cart
  const addToCart = (menuItem: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.menuItem.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { menuItem, quantity: 1 }];
    });
  };

  // Remove item from cart
  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItemId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.menuItem.id === menuItemId ? { ...item, quantity: item.quantity - 1 } : item,
        );
      }
      return prev.filter((item) => item.menuItem.id !== menuItemId);
    });
  };

  // Get cart quantity for an item
  const getCartQuantity = (menuItemId: string) => {
    return cart.find((item) => item.menuItem.id === menuItemId)?.quantity || 0;
  };

  // Tax multiplier for displaying tax-inclusive prices
  const taxMultiplier =
    cafeSettings?.tax_enabled && cafeSettings.tax_percentage > 0
      ? 1 + cafeSettings.tax_percentage / 100
      : 1;

  // Calculate cart total (tax-inclusive)
  const cartTotal =
    cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0) * taxMultiplier;

  // Get order total from database (includes tax) for consistency
  // Fall back to calculating from items if total is not set
  const orderTotal =
    activeOrder?.total ||
    activeOrder?.order_items?.reduce(
      (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
      0,
    ) ||
    0;

  // Calculate combined total for all orders on this table
  const combinedTotal = activeOrders.reduce((total: number, order: any) => {
    const orderSum =
      order.total ||
      order.order_items?.reduce(
        (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
        0,
      ) ||
      0;
    return total + orderSum;
  }, 0);

  // Submit cart items to existing order
  const handleAddItemsToOrder = async () => {
    if (cart.length === 0) {
      toast.error(t('orders.addAtLeastOneItem'));
      return;
    }

    if (!activeOrder) {
      toast.error(t('orders.noActiveOrder'));
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = cart.map((item) => ({
        order_id: activeOrder.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        quantity: item.quantity,
        item_price: item.menuItem.price,
        notes: null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);
      toast.success(t('orders.itemsAddedToOrder'));
      setCart([]);
      refetchOrders();
    } catch (error) {
      console.error('Failed to add items:', error);
      toast.error(t('orders.failedAddItems'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (newStatus: string) => {
    if (!activeOrder) return;
    try {
      await updateOrderStatus.mutateAsync({
        orderId: activeOrder.id,
        status: newStatus as any,
      });
      toast.success(`${t('orders.statusUpdated')} ${newStatus.toLowerCase()}`);
      refetchOrders();
    } catch (_error) {
      toast.error(t('orders.failedUpdateStatus'));
    }
  };

  // Format duration
  const formatDuration = (createdAt: string) => {
    const start = new Date(createdAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'served':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get item status badge
  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-700',
          icon: <AlertCircle className="h-3 w-3" />,
          label: t('pending', { ns: 'common' }),
        };
      case 'preparing':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          icon: <ChefHat className="h-3 w-3" />,
          label: t('orders.preparing'),
        };
      case 'ready':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          icon: <CheckCircle className="h-3 w-3" />,
          label: t('orders.ready'),
        };
      case 'served':
        return {
          bg: 'bg-purple-100',
          text: 'text-purple-800',
          icon: <UtensilsCrossed className="h-3 w-3" />,
          label: t('orders.served'),
        };
      case 'cancelled':
        return {
          bg: 'bg-red-100',
          text: 'text-red-700',
          icon: <XCircle className="h-3 w-3" />,
          label: t('orders.cancelled'),
        };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: null, label: status };
    }
  };

  // Handle item status update — also syncs order-level status based on collective item states
  const handleItemStatusUpdate = async (itemId: string, newStatus: string) => {
    try {
      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served',
      });

      // Sync order status based on updated item states
      if (activeOrder?.order_items) {
        const updatedItems = activeOrder.order_items.map((item: OrderItem) =>
          item.id === itemId ? { ...item, status: newStatus } : item,
        );
        type ItemWithStatus = { status: string };
        const nonCancelled = updatedItems.filter((i: ItemWithStatus) => i.status !== 'cancelled');

        if (nonCancelled.length > 0) {
          const allServed = nonCancelled.every((i: ItemWithStatus) => i.status === 'served');
          const allReadyOrServed = nonCancelled.every(
            (i: ItemWithStatus) => i.status === 'ready' || i.status === 'served',
          );
          const anyPreparing = nonCancelled.some((i: ItemWithStatus) => i.status === 'preparing');

          let targetStatus: string | null = null;
          if (allServed && activeOrder.status !== 'served') {
            targetStatus = 'SERVED';
          } else if (allReadyOrServed && !allServed && activeOrder.status !== 'ready') {
            targetStatus = 'READY';
          } else if (anyPreparing && activeOrder.status === 'new') {
            targetStatus = 'PREPARING';
          }

          if (targetStatus) {
            await updateOrderStatus.mutateAsync({
              orderId: activeOrder.id,
              status: targetStatus as any,
            });
          }
        }
      }

      toast.success(t('orders.itemMarkedAs', { status: newStatus }));
      refetchOrders();
    } catch (_error) {
      toast.error(t('orders.failedUpdateItemStatus'));
    }
  };

  // Handle individual item cancellation (supports partial quantity)
  const handleCancelItem = async () => {
    if (!cancelItemConfirm || !activeOrder) return;

    setCancellingItem(true);
    try {
      await cancelOrderItem.mutateAsync({
        itemId: cancelItemConfirm.id,
        cancelQty: cancelItemQty,
      });
      toast.success(
        t('orders.itemCancelled', {
          item: `${cancelItemQty}x ${cancelItemConfirm.item_name}`,
        }),
      );
      setCancelItemConfirm(null);
      setCancelItemQty(1);
      refetchOrders();
    } catch (error: any) {
      toast.error(error.message || t('orders.failedCancelItem'));
    } finally {
      setCancellingItem(false);
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async () => {
    if (!activeOrder || !cancelReason.trim()) {
      toast.error(t('orders.reasonProvide'));
      return;
    }

    setCancelling(true);
    try {
      await cancelOrder.mutateAsync({
        orderId: activeOrder.id,
        reason: cancelReason.trim(),
        tableId: activeOrder.table_id,
      });
      toast.success(t('orders.orderCancelled'));
      setShowCancelModal(false);
      setCancelReason('');
      refetchOrders();

      // If there are other orders, stay on page, otherwise go back
      if (activeOrders.length <= 1) {
        router.push('/tables');
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error(t('orders.failedCancel'));
    } finally {
      setCancelling(false);
    }
  };

  if (tableLoading || menuLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">{t('tables.tableNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/tables')}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('back', { ns: 'common' })}</span>
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">{table.table_number}</h1>
          {activeOrder && (
            <span
              className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(activeOrder.status)}`}
            >
              {activeOrder.status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Multiple Orders Tab Selector */}
      {activeOrders.length > 1 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {activeOrders.length} {t('tables.ordersOnTable')}
            </span>
            <span className="text-sm text-amber-600">
              ({t('tables.combinedTotal')}: {formatPrice(combinedTotal)})
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeOrders.map((order: any, index: number) => {
              const orderItemsTotal =
                order.order_items?.reduce(
                  (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
                  0,
                ) || 0;
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderIndex(index)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedOrderIndex === index
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-amber-700 hover:bg-amber-100 border border-amber-300'
                  }`}
                >
                  {t('orders.order')} #{index + 1} ({formatPrice(orderItemsTotal)})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active order info */}
      {activeOrder && (
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDuration(activeOrder.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {formatPrice(orderTotal)}
                </span>
                {/* Order Taken By */}
                {(activeOrder as any).assigned_waiter && (
                  <span className="flex items-center gap-1">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <span className="text-green-700">
                      {t('orders.takenBy')} {(activeOrder as any).assigned_waiter.full_name}
                    </span>
                  </span>
                )}
              </div>
              {/* Customer Notes */}
              {(activeOrder as any).customer_notes && (
                <div className="mt-2 p-2 bg-amber-100 rounded-lg border border-amber-300">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">{t('notes', { ns: 'common' })}:</span>{' '}
                    {(activeOrder as any).customer_notes}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Pending Approval: Show approve button and QR indicator */}
              {activeOrder.status === 'pending_approval' && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatusUpdate('NEW')}
                  >
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    {t('approve', { ns: 'common' })}
                  </Button>
                  {(activeOrder as any).source === 'customer' && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                      <Smartphone className="h-3 w-3" />
                      {t('orders.qrOrder')}
                    </span>
                  )}
                </>
              )}
              {activeOrder.status === 'new' && (
                <Button size="sm" onClick={() => handleStatusUpdate('PREPARING')}>
                  <ChefHat className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">{t('start', { ns: 'common' })} </span>
                  {t('orders.preparing')}
                </Button>
              )}
              {activeOrder.status === 'preparing' && (
                <Button size="sm" onClick={() => handleStatusUpdate('READY')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">{t('mark', { ns: 'common' })} </span>
                  {t('orders.ready')}
                </Button>
              )}
              {activeOrder.status === 'ready' && (
                <Button size="sm" onClick={() => handleStatusUpdate('SERVED')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">{t('mark', { ns: 'common' })} </span>
                  {t('orders.served')}
                </Button>
              )}
              {activeOrder.status === 'served' && (
                <Button size="sm" onClick={() => router.push(`/orders/${activeOrder.id}`)}>
                  <CreditCard className="h-4 w-4 mr-1" />
                  {t('orders.payment')}
                </Button>
              )}
              {/* Transfer Items button */}
              {activeOrder.order_items?.some((i: OrderItem) => i.status !== 'cancelled') && (
                <Button size="sm" variant="outline" onClick={() => setShowItemTransferModal(true)}>
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  {t('tables.transferItems')}
                </Button>
              )}
              {/* Cancel/Reject button - available for active orders */}
              {['pending_approval', 'new', 'preparing', 'ready', 'served'].includes(
                activeOrder.status,
              ) && (
                <Button size="sm" variant="destructive" onClick={() => setShowCancelModal(true)}>
                  <XCircle className="h-4 w-4 mr-1" />
                  {activeOrder.status === 'pending_approval'
                    ? t('reject', { ns: 'common' })
                    : t('cancel', { ns: 'common' })}
                </Button>
              )}
            </div>
          </div>

          {/* Current order items */}
          {activeOrder.order_items && activeOrder.order_items.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="font-medium mb-2">{t('orders.currentItems')}</h3>
              <div className="space-y-2">
                {activeOrder.order_items.map((item: OrderItem) => {
                  const statusBadge = getItemStatusBadge(item.status);
                  const isCancelled = item.status === 'cancelled';

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between text-sm gap-2 py-1 ${isCancelled ? 'opacity-50' : ''}`}
                    >
                      <span className={`flex-1 ${isCancelled ? 'line-through text-gray-400' : ''}`}>
                        {item.quantity}x {item.item_name}
                      </span>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {isCancelled ? (
                          <span
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                          >
                            {statusBadge.icon}
                            {statusBadge.label}
                          </span>
                        ) : (
                          <>
                            {(item.status === 'pending' || item.status === 'preparing') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemStatusUpdate(item.id, 'ready');
                                }}
                                className="px-2 py-1 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                              >
                                <CheckCircle className="h-3 w-3" />
                                {t('orders.ready')}
                              </button>
                            )}
                            {item.status === 'ready' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemStatusUpdate(item.id, 'served');
                                }}
                                className="px-2 py-1 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                              >
                                <UtensilsCrossed className="h-3 w-3" />
                                {t('orders.served')}
                              </button>
                            )}
                            {item.status === 'served' && (
                              <span
                                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}
                              >
                                {statusBadge.icon}
                                {t('orders.done')}
                              </span>
                            )}
                            {/* Cancel item button — not shown for served items */}
                            {item.status !== 'served' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelItemConfirm(item);
                                  setCancelItemQty(1);
                                }}
                                className="px-1.5 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title={t('orders.cancelItem')}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <span
                        className={`w-16 text-right ${isCancelled ? 'line-through text-gray-400' : 'text-gray-600'}`}
                      >
                        {formatPrice(item.quantity * item.item_price)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Menu and Cart - always show */}
      {/* Category Filter */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="flex-shrink-0"
        >
          {t('all', { ns: 'common' })}
        </Button>
        {categories?.map((category: Category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.id)}
            className="flex-shrink-0"
          >
            {category.name}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Menu Items Grid */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
            {filteredItems?.map((item: MenuItem) => {
              const quantity = getCartQuantity(item.id);
              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-3 sm:p-4 cursor-pointer transition-all ${
                    quantity > 0 ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                  }`}
                  onClick={() => addToCart(item)}
                >
                  <div className="flex justify-between items-start mb-1 sm:mb-2">
                    <h3 className="font-medium text-xs sm:text-sm line-clamp-2">{item.name}</h3>
                    {quantity > 0 && (
                      <span className="bg-blue-500 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ml-1 flex-shrink-0">
                        {quantity}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 mb-1 sm:mb-2 line-clamp-2 hidden sm:block">
                      {item.description}
                    </p>
                  )}
                  <p className="font-semibold text-blue-600 text-sm sm:text-base">
                    {formatPrice(item.price * taxMultiplier)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart Sidebar */}
        <div className="lg:col-span-1 order-1 lg:order-2">
          <div className="border rounded-lg p-3 sm:p-4 lg:sticky lg:top-4 bg-white">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              {activeOrder ? t('orders.addItems') : t('orders.new')} (
              {cart.reduce((sum, item) => sum + item.quantity, 0)})
            </h2>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t('orders.clickToAdd')}</p>
            ) : (
              <>
                <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item.menuItem.id}
                      className="flex items-center justify-between border-b pb-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.menuItem.name}</p>
                        <p className="text-sm text-gray-600">
                          {formatPrice(item.menuItem.price * taxMultiplier)} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(item.menuItem.id);
                          }}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item.menuItem);
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order Notes */}
                <div className="mb-4">
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder={t('orders.customerNotesPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">{t('total', { ns: 'common' })}</span>
                    <span className="font-semibold text-lg">{formatPrice(cartTotal)}</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={activeOrder ? handleAddItemsToOrder : handleCreateOrderWithItems}
                    disabled={submitting || cart.length === 0}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {activeOrder ? t('orders.adding') : t('orders.creating')}
                      </>
                    ) : activeOrder ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {t('orders.addToOrder')} #{selectedOrderIndex + 1}
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        {t('orders.createOrder')}
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-600">{t('orders.cancelOrder')}</h2>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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

      {/* Cancel Item Confirmation with Quantity Selector */}
      {cancelItemConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6">
            <h3 className="text-lg font-bold mb-2">{t('orders.cancelItem')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('orders.cancelItemConfirm')} <strong>{cancelItemConfirm.item_name}</strong>?
            </p>

            {/* Quantity selector — only show if item has quantity > 1 */}
            {cancelItemConfirm.quantity > 1 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('orders.cancelQuantity')}
                </label>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setCancelItemQty((q) => Math.max(1, q - 1))}
                    disabled={cancelItemQty <= 1}
                    className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-bold w-8 text-center">{cancelItemQty}</span>
                  <button
                    onClick={() =>
                      setCancelItemQty((q) => Math.min(cancelItemConfirm.quantity, q + 1))
                    }
                    disabled={cancelItemQty >= cancelItemConfirm.quantity}
                    className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-500">/ {cancelItemConfirm.quantity}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCancelItemConfirm(null);
                  setCancelItemQty(1);
                }}
                disabled={cancellingItem}
              >
                {t('orders.keepItem')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancelItem}
                disabled={cancellingItem}
              >
                {cancellingItem ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `${t('orders.cancelItem')} (${cancelItemQty})`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Item Transfer Modal */}
      {activeOrder && (
        <ItemTransferModal
          isOpen={showItemTransferModal}
          onClose={() => setShowItemTransferModal(false)}
          order={activeOrder}
          sourceTableId={tableId}
          onSuccess={() => {
            setShowItemTransferModal(false);
            toast.success(t('tables.itemsTransferred'));
            refetchOrders();
          }}
        />
      )}
    </div>
  );
}
