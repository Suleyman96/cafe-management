'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTable, useOrders, useMenuItems, useCategories, useCreateOrder, useAddOrderItems, useUpdateOrderStatus } from '@/hooks';
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
} from 'lucide-react';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
};

export default function TableDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.id as string;

  const { data: table, isLoading: tableLoading } = useTable(tableId);
  const { data: orders, refetch: refetchOrders } = useOrders();
  const { data: menuItems, isLoading: menuLoading } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();

  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();
  const updateOrderStatus = useUpdateOrderStatus();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Get active order for this table
  const activeOrder = orders?.find((order: any) =>
    order.table_id === tableId &&
    ['new', 'preparing', 'ready', 'served'].includes(order.status)
  );

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
      return [...prev, { menuItem, quantity: 1, notes: '' }];
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

  // Create new order for table
  const handleCreateOrder = async () => {
    setCreatingOrder(true);
    try {
      await createOrder.mutateAsync({
        table_id: tableId,
        order_type: 'dine_in',
        status: 'new',
      } as any);
      toast.success('Order created');
      refetchOrders();
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error('Failed to create order');
    } finally {
      setCreatingOrder(false);
    }
  };

  // Submit cart items to order
  const handleSubmitItems = async () => {
    if (cart.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    if (!activeOrder) {
      toast.error('No active order. Please create one first.');
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
        notes: item.notes || null,
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
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/tables')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Table {table.table_number}</h1>
          {activeOrder && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(activeOrder.status)}`}>
              {activeOrder.status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* No active order - show create button */}
      {!activeOrder && (
        <div className="bg-gray-50 rounded-lg p-8 text-center mb-6">
          <p className="text-gray-600 mb-4">No active order for this table</p>
          <Button onClick={handleCreateOrder} disabled={creatingOrder}>
            {creatingOrder ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create New Order
              </>
            )}
          </Button>
        </div>
      )}

      {/* Active order info */}
      {activeOrder && (
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDuration(activeOrder.created_at)}
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  ${orderTotal.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {activeOrder.status === 'new' && (
                <Button size="sm" onClick={() => handleStatusUpdate('PREPARING')}>
                  <ChefHat className="h-4 w-4 mr-1" />
                  Start Preparing
                </Button>
              )}
              {activeOrder.status === 'preparing' && (
                <Button size="sm" onClick={() => handleStatusUpdate('READY')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Ready
                </Button>
              )}
              {activeOrder.status === 'ready' && (
                <Button size="sm" onClick={() => handleStatusUpdate('SERVED')}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Served
                </Button>
              )}
              {activeOrder.status === 'served' && (
                <Button size="sm" onClick={() => router.push(`/orders/${activeOrder.id}`)}>
                  <CreditCard className="h-4 w-4 mr-1" />
                  Payment
                </Button>
              )}
            </div>
          </div>

          {/* Current order items */}
          {activeOrder.order_items && activeOrder.order_items.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h3 className="font-medium mb-2">Current Items</h3>
              <div className="space-y-2">
                {activeOrder.order_items.map((item: OrderItem) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.quantity}x {item.item_name}</span>
                    <span>${(item.quantity * item.item_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Menu and Cart - only show if there's an active order */}
      {activeOrder && (
        <>
          {/* Category Filter */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories?.map((category: Category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name_en}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Menu Items Grid */}
            <div className="lg:col-span-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredItems?.map((item: MenuItem) => {
                  const quantity = getCartQuantity(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        quantity > 0 ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                      }`}
                      onClick={() => addToCart(item)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-sm">{item.name_en}</h3>
                        {quantity > 0 && (
                          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                            {quantity}
                          </span>
                        )}
                      </div>
                      {item.description_en && (
                        <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                          {item.description_en}
                        </p>
                      )}
                      <p className="font-semibold text-blue-600">${item.price.toFixed(2)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cart Sidebar */}
            <div className="lg:col-span-1">
              <div className="border rounded-lg p-4 sticky top-4">
                <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Add Items ({cart.reduce((sum, item) => sum + item.quantity, 0)})
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
                              ${item.menuItem.price.toFixed(2)} x {item.quantity}
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

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold text-lg">${cartTotal.toFixed(2)}</span>
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleSubmitItems}
                        disabled={submitting || cart.length === 0}
                      >
                        {submitting ? (
                          'Adding...'
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Add to Order
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
      )}
    </div>
  );
}
