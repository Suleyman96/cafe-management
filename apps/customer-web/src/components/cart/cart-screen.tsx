"use client";

import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart-store";
import { useLanguageStore } from "@/store/language-store";
import { useTable } from "@/hooks/use-table";
import { useOrder, useCreateOrder, useAddOrderItems } from "@/hooks/use-order";
import { getLocalizedField } from "@/types";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Trash2, Plus, Minus, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface CartScreenProps {
  tableId: string; // This is the table_number from URL (e.g., "T01")
}

export function CartScreen({ tableId }: CartScreenProps) {
  const router = useRouter();
  const { language } = useLanguageStore();
  const { items, updateQuantity, updateNotes, removeItem, clearCart, getTotal } = useCartStore();
  const [orderNotes, setOrderNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<Record<string, string>>({});

  // Fetch table to get the actual UUID for database operations
  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || ""; // UUID for database operations

  const { data: existingOrder } = useOrder(actualTableId);
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();

  const subtotal = getTotal();
  const tax = subtotal * 0.18; // 18% tax
  const total = subtotal + tax;

  const handlePlaceOrder = async () => {
    if (items.length === 0 || !actualTableId) return;

    try {
      let orderId = existingOrder?.id;

      // Create new order if none exists
      if (!orderId) {
        const newOrder = await createOrder.mutateAsync({
          tableId: actualTableId, // Use UUID for database
          notes: orderNotes,
        });
        orderId = newOrder.id;
      }

      // Add items to order
      await addOrderItems.mutateAsync({
        orderId,
        items: items.map((item) => ({
          menu_item_id: item.menuItem.id,
          item_name: getLocalizedField(item.menuItem, "name", language),
          item_price: item.menuItem.price,
          quantity: item.quantity,
          notes: item.notes,
        })),
      });

      toast.success("Order placed successfully!");
      clearCart();
      router.push(`/table/${tableId}/order`);
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error("Failed to place order. Please try again.");
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
          <p className="text-muted-foreground">
            Add some items from the menu to get started!
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => router.push(`/table/${tableId}/menu`)}
        >
          Browse Menu
        </Button>
      </div>
    );
  }

  const isLoading = createOrder.isPending || addOrderItems.isPending;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Your Order</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearCart}
            className="text-destructive"
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="p-4">
        {/* Cart Items */}
        <div className="space-y-4 mb-6">
          {items.map((item) => {
            const name = getLocalizedField(item.menuItem, "name", language);
            const isEditingThisItem = editingNotes === item.menuItem.id;
            
            return (
              <div
                key={item.menuItem.id}
                className="bg-card rounded-lg p-4 border"
              >
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

                {/* Item Notes Section */}
                <div className="mb-3">
                  {!isEditingThisItem ? (
                    <div>
                      {item.notes ? (
                        <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
                          <span className="text-sm">📝 {item.notes}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-auto"
                            onClick={() => {
                              setEditingNotes(item.menuItem.id);
                              setTempNotes({ 
                                ...tempNotes, 
                                [item.menuItem.id]: item.notes || '' 
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
                            setTempNotes({ 
                              ...tempNotes, 
                              [item.menuItem.id]: '' 
                            });
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
                        placeholder="e.g., no onions, extra sauce, well done..."
                        value={tempNotes[item.menuItem.id] || ''}
                        onChange={(e) => setTempNotes({ 
                          ...tempNotes, 
                          [item.menuItem.id]: e.target.value 
                        })}
                        maxLength={200}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setEditingNotes(null);
                            const { [item.menuItem.id]: _, ...rest } = tempNotes;
                            setTempNotes(rest);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            updateNotes(
                              item.menuItem.id, 
                              tempNotes[item.menuItem.id] || ''
                            );
                            setEditingNotes(null);
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateQuantity(item.menuItem.id, item.quantity - 1)
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-bold w-8 text-center">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateQuantity(item.menuItem.id, item.quantity + 1)
                      }
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
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">
            Order notes (optional)
          </label>
          <textarea
            className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background"
            placeholder="Any special requests for your order..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Price Summary (Fixed Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (18%)</span>
            <span>{formatPrice(tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total</span>
            <span className="text-primary">{formatPrice(total)}</span>
          </div>
        </div>

        <Button
          size="xl"
          className="w-full"
          onClick={handlePlaceOrder}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Placing Order...
            </>
          ) : (
            `Place Order · ${formatPrice(total)}`
          )}
        </Button>
      </div>
    </div>
  );
}

