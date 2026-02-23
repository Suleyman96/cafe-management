'use client';

import { ArrowLeft, Edit3, MapPin, Minus, Phone, Plus, Trash2, Truck, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAddDeliveryOrderItems, useCreateDeliveryOrder } from '@/hooks/use-delivery';
import {
  calculateTax,
  calculateTotal,
  getDisplaySubtotal,
  useCafeSettings,
} from '@/hooks/use-settings';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { useDeliveryStore } from '@/store/delivery-store';
import { useLanguageStore } from '@/store/language-store';
import { getLocalizedField } from '@/types';

export function DeliveryCartScreen() {
  const router = useRouter();
  const { language } = useLanguageStore();
  const { items, updateQuantity, updateNotes, removeItem, clearCart, getTotal } = useCartStore();
  const { customerName, customerPhone, deliveryAddress, deliveryNotes, setLastOrderId } =
    useDeliveryStore();
  const [orderNotes, setOrderNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});

  const createDeliveryOrder = useCreateDeliveryOrder();
  const addDeliveryOrderItems = useAddDeliveryOrderItems();
  const { data: settings } = useCafeSettings();

  const cartSubtotal = getTotal();
  const deliveryFee = settings?.delivery_fee_default || 0;
  const displaySubtotal = settings ? getDisplaySubtotal(cartSubtotal, settings) : cartSubtotal;
  const tax = settings ? calculateTax(cartSubtotal, settings) : 0;
  const foodTotal = settings ? calculateTotal(cartSubtotal, settings) : cartSubtotal;
  const grandTotal = foodTotal + deliveryFee;

  const minimumMet =
    !settings?.minimum_delivery_amount || foodTotal >= settings.minimum_delivery_amount;

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;

    if (!minimumMet) {
      toast.error(
        `Minimum delivery order is ${formatPrice(settings?.minimum_delivery_amount || 0)}`,
      );
      return;
    }

    try {
      const order = await createDeliveryOrder.mutateAsync({
        customerName,
        customerPhone,
        deliveryAddress,
        deliveryNotes,
        deliveryFee,
        orderNotes,
      });

      await addDeliveryOrderItems.mutateAsync({
        orderId: order.id,
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          item_name: getLocalizedField(item.menuItem, 'name', language),
          item_price: item.menuItem.price,
          quantity: item.quantity,
          notes: item.notes,
        })),
      });

      setLastOrderId(order.id);
      toast.success('Delivery order placed!');
      clearCart();
      router.push(`/delivery/order/${order.id}`);
    } catch (error) {
      console.error('Error placing delivery order:', error);
      toast.error('Failed to place order. Please try again.');
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground">Add some items from the menu to get started!</p>
        </div>
        <Button size="lg" onClick={() => router.push('/delivery/menu')}>
          Browse Menu
        </Button>
      </div>
    );
  }

  const isLoading = createDeliveryOrder.isPending || addDeliveryOrderItems.isPending;

  return (
    <div className="min-h-screen bg-background pb-48">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Your Delivery Order</h1>
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive">
            Clear
          </Button>
        </div>
      </div>

      <div className="p-4">
        {/* Delivery Info Summary */}
        <div className="bg-card rounded-lg p-4 border mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Delivery Details
            </h2>
            <Button variant="ghost" size="sm" onClick={() => router.push('/delivery')}>
              <Edit3 className="h-3 w-3 mr-1" />
              Edit
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{customerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{customerPhone}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <span>{deliveryAddress}</span>
            </div>
            {deliveryNotes && <p className="text-muted-foreground pl-5">{deliveryNotes}</p>}
          </div>
        </div>

        {/* Cart Items */}
        <div className="space-y-4 mb-6">
          {items.map((item) => {
            const name = getLocalizedField(item.menuItem, 'name', language);
            const isEditingThisItem = editingNotes === item.menuItem.id;

            return (
              <div key={item.menuItem.id} className="bg-card rounded-lg p-4 border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold">{name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.menuItem.price)} each
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.menuItem.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Item Notes */}
                {settings?.allow_item_notes !== false && (
                  <div className="mb-3">
                    {!isEditingThisItem ? (
                      <div>
                        {item.notes ? (
                          <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
                            <span className="text-sm">{item.notes}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-auto"
                              onClick={() => {
                                setEditingNotes(item.menuItem.id);
                                setTempNotes({
                                  ...tempNotes,
                                  [item.menuItem.id]: item.notes || '',
                                });
                              }}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => {
                              setEditingNotes(item.menuItem.id);
                              setTempNotes({ ...tempNotes, [item.menuItem.id]: '' });
                            }}
                          >
                            <Edit3 className="h-3 w-3 mr-1" />
                            Add special notes
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          className="w-full min-h-[60px] p-2 text-sm rounded-md border border-input bg-background"
                          placeholder="e.g., no onions, extra sauce..."
                          value={tempNotes[item.menuItem.id] || ''}
                          onChange={(e) =>
                            setTempNotes({ ...tempNotes, [item.menuItem.id]: e.target.value })
                          }
                          maxLength={200}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setEditingNotes(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              updateNotes(item.menuItem.id, tempNotes[item.menuItem.id] || '');
                              setEditingNotes(null);
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-bold w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="font-bold text-lg">
                    {formatPrice(item.menuItem.price * item.quantity)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Notes */}
        {settings?.allow_order_notes !== false && (
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">Order notes (optional)</label>
            <textarea
              className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background"
              placeholder="Any special requests for your order..."
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Price Summary (Fixed Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
        <div className="space-y-2 mb-4">
          {settings?.tax_enabled && settings?.show_tax_separately ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {settings.tax_label} ({settings.tax_percentage}%)
                </span>
                <span>{formatPrice(tax)}</span>
              </div>
            </>
          ) : null}
          {deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span>{formatPrice(deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">{formatPrice(grandTotal)}</span>
          </div>
        </div>

        {/* Minimum Order Warning */}
        {!minimumMet && settings?.minimum_delivery_amount && (
          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-300 text-center">
              Minimum delivery order: {formatPrice(settings.minimum_delivery_amount)}
            </p>
          </div>
        )}

        <Button
          size="xl"
          className="w-full"
          onClick={handlePlaceOrder}
          disabled={isLoading || !minimumMet}
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Placing Order...
            </>
          ) : !minimumMet ? (
            'Minimum order not met'
          ) : (
            `Place Delivery Order · ${formatPrice(grandTotal)}`
          )}
        </Button>
      </div>
    </div>
  );
}
