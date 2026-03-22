'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { ArrowLeft, Check, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  useAddOrderItems,
  useCafeSettings,
  useCategories,
  useMenuItems,
  useOrder,
  useUpdateOrderNotes,
} from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';

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
  const { t } = useTranslation('staff');

  const { data: order, isLoading: orderLoading } = useOrder(orderId);
  const { data: menuItems, isLoading: menuLoading } = useMenuItems({ isAvailable: true });
  const { data: categories } = useCategories();
  const addOrderItems = useAddOrderItems();
  const updateOrderNotes = useUpdateOrderNotes();
  const { data: cafeSettings } = useCafeSettings();
  const formatPrice = useFormatPrice();

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

  // Submit order items
  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error(t('orders.addAtLeastOneItem'));
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = cart.map((item) => ({
        order_id: orderId,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
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

      toast.success(t('orders.itemsAddedToOrder'));
      router.push(`/orders/${orderId}`);
    } catch (error) {
      console.error('Failed to add items:', error);
      toast.error(t('orders.failedAddItems'));
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
        <p className="text-red-500">{t('orders.orderNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{t('back', { ns: 'common' })}</span>
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold">
            {t('orders.addItems')} -{' '}
            {(order as any).table?.table_number
              ? (order as any).table.table_number
              : t('tables.takeout')}
          </h1>
        </div>
      </div>

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
            <h2 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
              {t('orders.cart')} ({cart.reduce((sum, item) => sum + item.quantity, 0)}{' '}
              {t('tables.items')})
            </h2>

            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-4 sm:py-8 text-sm">
                {t('orders.clickToAdd')}
              </p>
            ) : (
              <>
                <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4 max-h-48 sm:max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div
                      key={item.menuItem.id}
                      className="flex items-center justify-between border-b pb-2 sm:pb-3"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="font-medium text-xs sm:text-sm truncate">
                          {item.menuItem.name}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600">
                          {formatPrice(item.menuItem.price * taxMultiplier)} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(item.menuItem.id);
                          }}
                        >
                          <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        <span className="w-6 sm:w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item.menuItem);
                          }}
                        >
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Customer Notes */}
                <div className="mb-3 sm:mb-4">
                  <textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder={t('orders.customerNotesPlaceholder')}
                    className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-xs sm:text-sm"
                    rows={2}
                  />
                </div>

                <div className="border-t pt-3 sm:pt-4">
                  <div className="flex justify-between items-center mb-3 sm:mb-4">
                    <span className="font-semibold text-sm sm:text-base">
                      {t('total', { ns: 'common' })}
                    </span>
                    <span className="font-semibold text-base sm:text-lg">
                      {formatPrice(cartTotal)}
                    </span>
                  </div>
                  <Button
                    className="w-full text-sm sm:text-base"
                    onClick={handleSubmit}
                    disabled={submitting || cart.length === 0}
                  >
                    {submitting ? (
                      t('orders.adding')
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {t('orders.addToOrder')}
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
