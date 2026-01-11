"use client";

import { useState } from "react";
import Image from "next/image";
import { useLanguageStore } from "@/store/language-store";
import { useCartStore } from "@/store/cart-store";
import { getLocalizedField, type MenuItemWithCategory } from "@/types";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Minus, Star, Leaf, Flame, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface MenuItemModalProps {
  item: MenuItemWithCategory;
  isOpen: boolean;
  onClose: () => void;
}

export function MenuItemModal({ item, isOpen, onClose }: MenuItemModalProps) {
  const { language } = useLanguageStore();
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const name = getLocalizedField(item, "name", language);
  const description = getLocalizedField(item, "description", language);

  const handleAdd = () => {
    addItem(item, quantity, notes);
    toast.success(`Added ${quantity}x ${name} to cart`);
    onClose();
    setQuantity(1);
    setNotes("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="relative w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-lg max-h-[90vh] overflow-y-auto">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm rounded-full"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Image */}
          {item.image_url && (
            <div className="relative h-64 w-full bg-muted">
              <Image
                src={item.image_url}
                alt={name}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {/* Title and Badges */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">{name}</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {item.is_popular && (
                  <Badge variant="warning">
                    <Star className="h-3 w-3 mr-1" />
                    Popular
                  </Badge>
                )}
                {item.is_vegetarian && (
                  <Badge variant="outline">
                    <Leaf className="h-3 w-3 mr-1 text-green-600" />
                    Vegetarian
                  </Badge>
                )}
                {item.is_vegan && (
                  <Badge variant="outline">
                    <Leaf className="h-3 w-3 mr-1 text-green-600" />
                    Vegan
                  </Badge>
                )}
                {item.is_spicy && (
                  <Badge variant="outline">
                    <Flame className="h-3 w-3 mr-1 text-red-600" />
                    Spicy
                  </Badge>
                )}
                {item.is_gluten_free && (
                  <Badge variant="outline">Gluten Free</Badge>
                )}
              </div>
            </div>

            {/* Description */}
            {description && (
              <p className="text-muted-foreground mb-4">{description}</p>
            )}

            {/* Allergens */}
            {item.allergens && item.allergens.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Contains allergens:</p>
                    <p className="text-sm">{item.allergens.join(", ")}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Prep Time */}
            {item.preparation_time && (
              <p className="text-sm text-muted-foreground mb-4">
                ⏱️ Preparation time: ~{item.preparation_time} minutes
              </p>
            )}

            {/* Price */}
            <div className="text-3xl font-bold text-primary mb-4">
              {formatPrice(item.price)}
            </div>

            {/* Quantity Selector */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Quantity</label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-2xl font-bold w-12 text-center">
                  {quantity}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Special Notes */}
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">
                Special requests (optional)
              </label>
              <textarea
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background"
                placeholder="e.g., Less sugar, Extra hot, No ice..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Add to Cart Button */}
            <Button size="xl" className="w-full" onClick={handleAdd}>
              Add to Order · {formatPrice(item.price * quantity)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


