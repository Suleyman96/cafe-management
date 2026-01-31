'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTable, useOrders, useMenuItems, useCategories, useCreateOrder, useAddOrderItems, useUpdateOrderStatus, useUpdateOrderItemStatus, useCancelOrder, useCafeSettings, formatPriceWithSettings } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@cafe-idare/database';
import {
  ArrowLeft,
  Plus,
  Minus,
  ShoppingCart,
  Check,
  Clock,
  DollarSign,
  ChefHat,
  CheckCircle,
  CreditCard,
  Loader2,
  UserCheck,
  AlertCircle,
  UtensilsCrossed,
  XCircle,
  X,
  Layers,
} from 'lucide-react';

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

  const { data: table, isLoading: tableLoading } = useTable(tableId);
  const { data: orders, refetch: refetchOrders } = useOrders();
  const { data: menuItems, isLoading: menuLoading } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();

  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateItemStatus = useUpdateOrderItemStatus();
  const cancelOrder = useCancelOrder();
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

  // Get ALL active orders for this table
  const activeOrders = useMemo(() => {
    return orders?.filter((order: any) =>
      order.table_id === tableId &&
      ['new', 'preparing', 'ready', 'served'].includes(order.status)
    ) || [];
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
  }, [tableId]);

  // Create order with items (for new orders on free tables)
  const handleCreateOrderWithItems = async () => {
    if (cart.length === 0) {
      toast.error('Please add at least one item');
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
        item_name: item.menuItem.name_en,
        quantity: item.quantity,
        item_price: item.menuItem.price,
        notes: null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);
      toast.success('Order created');
      setCart([]);
      setOrderNotes('');
      refetchOrders();
    } catch (error: any) {
      console.error('Failed to create order:', error);
      toast.error('Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`table-${tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          refetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => {
          refetchOrders();
        }
      )
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
          item.menuItem.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
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
          item.menuItem.id === menuItemId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter((item) => item.menuItem.id !== menuItemId);
    });
  };

  // Get cart quantity for an item
  const getCartQuantity = (menuItemId: string) => {
    return cart.find((item) => item.menuItem.id === menuItemId)?.quantity || 0;
  };

  // Calculate cart total
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.menuItem.price * item.quantity,
    0
  );

  // Calculate existing order total
  const orderTotal = activeOrder?.order_items?.reduce(
    (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
    0
  ) || 0;

  // Calculate combined total for all orders on this table
  const combinedTotal = activeOrders.reduce((total: number, order: any) => {
    const orderSum = order.order_items?.reduce(
      (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
      0
    ) || 0;
    return total + orderSum;
  }, 0);

  // Submit cart items to existing order
  const handleAddItemsToOrder = async () => {
    if (cart.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (!activeOrder) {
      toast.error('No active order');
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = cart.map((item) => ({
        order_id: activeOrder.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name_en,
        quantity: item.quantity,
        item_price: item.menuItem.price,
        notes: null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);
      toast.success('Items added to order');
      setCart([]);
      refetchOrders();
    } catch (error) {
      console.error('Failed to add items:', error);
      toast.error('Failed to add items');
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
      toast.success(`Order status updated to ${newStatus.toLowerCase()}`);
      refetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
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
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-yellow-100 text-yellow-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'served': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get item status badge
  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: <AlertCircle className="h-3 w-3" />, label: 'Pending' };
      case 'preparing':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <ChefHat className="h-3 w-3" />, label: 'Preparing' };
      case 'ready':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="h-3 w-3" />, label: 'Ready' };
      case 'served':
        return { bg: 'bg-purple-100', text: 'text-purple-800', icon: <UtensilsCrossed className="h-3 w-3" />, label: 'Served' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', icon: null, label: status };
    }
  };

  // Handle item status update
  const handleItemStatusUpdate = async (itemId: string, newStatus: string) => {
    try {
      await updateItemStatus.mutateAsync({
        itemId,
        status: newStatus as 'pending' | 'preparing' | 'ready' | 'served'
      });
      toast.success(`Item marked as ${newStatus}`);
      refetchOrders();
    } catch (error) {
      toast.error('Failed to update item status');
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async () => {
    if (!activeOrder || !cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }

    setCancelling(true);
    try {
      await cancelOrder.mutateAsync({
        orderId: activeOrder.id,
        reason: cancelReason.trim(),
        tableId: activeOrder.table_id
      });
      toast.success('Order cancelled');
      setShowCancelModal(false);
      setCancelReason('');
      refetchOrders();

      // If there are other orders, stay on page, otherwise go back
      if (activeOrders.length <= 1) {
        router.push('/tables');
      }
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error('Failed to cancel order');
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
        <p className="text-red-500">Table not found</p>
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
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">Table {table.table_number}</h1>
          {activeOrder && (
            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(activeOrder.status)}`}>
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
              {activeOrders.length} orders on this table
            </span>
            <span className="text-sm text-amber-600">
              (Combined: {formatPrice(combinedTotal)})
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {activeOrders.map((order: any, index: number) => {
              const orderItemsTotal = order.order_items?.reduce(
                (sum: number, item: OrderItem) => sum + item.quantity * item.item_price,
                0
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
                  Order #{index + 1} ({formatPrice(orderItemsTotal)})
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
                    <span className="text-green-700">Taken by: {(activeOrder as any).assigned_waiter.full_name}</span>
                  </span>
                )}
              </div>
              {/* Customer Notes */}
              {(activeOrder as any).customer_notes && (
                <div className="mt-2 p-2 bg-amber-100 rounded-lg border border-amber-300">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Note:</span> {(activeOrder as any).customer_notes}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeOrder.status === 'new' && (
                <Button size="sm" onClick={() => handleStatusUpdate('PREPARING')}>
                  <ChefHat className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Start </span>Preparing
                </Button>
              )}
              {activeOrder.status === 'preparing' && (
                <Button size="sm" onClick={() => handleStatusUpdate('READY')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Mark </span>Ready
                </Button>
              )}
              {activeOrder.status === 'ready' && (
                <Button size="sm" onClick={() => handleStatusUpdate('SERVED')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Mark </span>Served
                </Button>
              )}
              {activeOrder.status === 'served' && (
                <Button size="sm" onClick={() => router.push(`/orders/${activeOrder.id}`)}>
                  <CreditCard className="h-4 w-4 mr-1" />
                  Payment
                </Button>
              )}
              {/* Cancel button - available for new and preparing orders */}
              {['new', 'preparing'].includes(activeOrder.status) && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowCancelModal(true)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Current order items */}
          {activeOrder.order_items && activeOrder.order_items.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="font-medium mb-2">Current Items</h3>
              <div className="space-y-2">
                {activeOrder.order_items.map((item: OrderItem) => {
                  const statusBadge = getItemStatusBadge(item.status);

                  return (
                    <div key={item.id} className="flex items-center justify-between text-sm gap-2 py-1">
                      <span className="flex-1">{item.quantity}x {item.item_name}</span>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {(item.status === 'pending' || item.status === 'preparing') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemStatusUpdate(item.id, 'ready');
                            }}
                            className="px-2 py-1 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Ready
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
                            Served
                          </button>
                        )}
                        {item.status === 'served' && (
                          <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusBadge.bg} ${statusBadge.text}`}>
                            {statusBadge.icon}
                            Done
                          </span>
                        )}
                      </div>

                      <span className="text-gray-600 w-16 text-right">{formatPrice(item.quantity * item.item_price)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Menu and Cart - always show */}
      <>
        {/* Category Filter */}
        <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="flex-shrink-0"
          >
            All
          </Button>
          {categories?.map((category: Category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="flex-shrink-0"
            >
              {category.name_en}
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
                      <h3 className="font-medium text-xs sm:text-sm line-clamp-2">{item.name_en}</h3>
                      {quantity > 0 && (
                        <span className="bg-blue-500 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ml-1 flex-shrink-0">
                          {quantity}
                        </span>
                      )}
                    </div>
                    {item.description_en && (
                      <p className="text-xs text-gray-500 mb-1 sm:mb-2 line-clamp-2 hidden sm:block">
                        {item.description_en}
                      </p>
                    )}
                    <p className="font-semibold text-blue-600 text-sm sm:text-base">{formatPrice(item.price)}</p>
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
                {activeOrder ? 'Add Items' : 'New Order'} ({cart.reduce((sum, item) => sum + item.quantity, 0)})
              </h2>

              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Click on menu items to add them
                </p>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {cart.map((item) => (
                      <div
                        key={item.menuItem.id}
                        className="flex items-center justify-between border-b pb-3"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.menuItem.name_en}</p>
                          <p className="text-sm text-gray-600">
                            {formatPrice(item.menuItem.price)} x {item.quantity}
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
                      placeholder="Notes from customers"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                      rows={2}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-semibold">Total</span>
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
                          {activeOrder ? 'Adding...' : 'Creating...'}
                        </>
                      ) : (
                        <>
                          {activeOrder ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Add to Order #{selectedOrderIndex + 1}
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Create Order
                            </>
                          )}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-600">Cancel Order</h2>
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
