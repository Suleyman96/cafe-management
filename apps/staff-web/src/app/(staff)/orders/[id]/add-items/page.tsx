'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrder, useMenuItems, useCategories, useAddOrderItems, useUpdateOrderNotes } from '@/hooks';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { toast } from 'sonner';
import type { Database } from '@cafe-idare/database';
import {
  ArrowLeft,
  Plus,
  Minus,
  ShoppingCart,
  Check,
} from 'lucide-react';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];
type Category = Database['public']['Tables']['categories']['Row'];

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
};

export default function AddItemsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { data: order, isLoading: orderLoading } = useOrder(orderId);
  const { data: menuItems, isLoading: menuLoading } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();
  const addOrderItems = useAddOrderItems();
  const updateOrderNotes = useUpdateOrderNotes();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');

  // Initialize customer notes from existing order
  useEffect(() => {
    if (order && (order as any).customer_notes) {
      setCustomerNotes((order as any).customer_notes);
    }
  }, [order]);

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

  // Submit order items
  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = cart.map((item) => ({
        order_id: orderId,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name_en,
        quantity: item.quantity,
        item_price: item.menuItem.price,
        notes: null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);

      // Update customer notes if changed
      const existingNotes = (order as any)?.customer_notes || '';
      if (customerNotes.trim() !== existingNotes) {
        await updateOrderNotes.mutateAsync({
          orderId,
          notes: { customer_notes: customerNotes.trim() || null },
        });
      }

      toast.success('Items added to order');
      router.push(`/orders/${orderId}`);
    } catch (error) {
      console.error('Failed to add items:', error);
      toast.error('Failed to add items. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (orderLoading || menuLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Order not found</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">
            Add Items - Table {(order as any).table?.table_number || 'Takeout'}
          </h1>
        </div>
      </div>

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
              Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)} items)
            </h2>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Click on menu items to add them to the order
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

                {/* Customer Notes */}
                <div className="mb-4">
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Notes from customer..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold text-lg">${cartTotal.toFixed(2)}</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSubmit}
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
    </div>
  );
}
