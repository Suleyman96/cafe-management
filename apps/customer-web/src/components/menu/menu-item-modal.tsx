'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { AlertCircle, Flame, Leaf, Minus, Plus, Star, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice as formatPriceWithSettings, useCafeSettings } from '@/hooks/use-settings';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import type { MenuItemWithCategory } from '@/types';

interface MenuItemModalProps {
  item: MenuItemWithCategory;
  isOpen: boolean;
  onClose: () => void;
}

export function MenuItemModal({ item, isOpen, onClose }: MenuItemModalProps) {
  const { t } = useTranslation('customer');
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const { data: settings } = useCafeSettings();

  const name = item.name;
  const description = item.description;

  // Format price using cafe settings or fallback
  const displayPrice = (amount: number) => {
    if (settings) {
      return formatPriceWithSettings(amount, settings);
    }
    return formatPrice(amount);
  };

  const handleAdd = () => {
    addItem(item, quantity, notes);
    toast.success(t('menuItem.addedToCart', { count: quantity, name }));
    onClose();
    setQuantity(1);
    setNotes('');
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
              <Image src={item.image_url} alt={name} fill className="object-cover" unoptimized />
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
                    {t('menuItem.badgePopular')}
                  </Badge>
                )}
                {item.is_vegetarian && (
                  <Badge variant="outline">
                    <Leaf className="h-3 w-3 mr-1 text-green-600" />
                    {t('menuItem.badgeVegetarian')}
                  </Badge>
                )}
                {item.is_vegan && (
                  <Badge variant="outline">
                    <Leaf className="h-3 w-3 mr-1 text-green-600" />
                    {t('menuItem.badgeVegan')}
                  </Badge>
                )}
                {item.is_spicy && (
                  <Badge variant="outline">
                    <Flame className="h-3 w-3 mr-1 text-red-600" />
                    {t('menuItem.badgeSpicy')}
                  </Badge>
                )}
                {item.is_gluten_free && (
                  <Badge variant="outline">{t('menuItem.badgeGlutenFree')}</Badge>
                )}
              </div>
            </div>

            {/* Description */}
            {description && <p className="text-muted-foreground mb-4">{description}</p>}

            {/* Allergens */}
            {item.allergens && item.allergens.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{t('menuItem.allergens')}</p>
                    <p className="text-sm">{item.allergens.join(', ')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Prep Time */}
            {item.preparation_time && (
              <p className="text-sm text-muted-foreground mb-4">
                ⏱️ {t('menuItem.prepTimeFull', { count: item.preparation_time })}
              </p>
            )}

            {/* Price */}
            <div className="text-3xl font-bold text-primary mb-4">{displayPrice(item.price)}</div>

            {/* Quantity Selector */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">
                {t('menuItem.quantityLabel')}
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-2xl font-bold w-12 text-center">{quantity}</span>
                <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Special Notes - Only show if allow_item_notes is enabled */}
            {settings?.allow_item_notes !== false && (
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">
                  {t('menuItem.specialRequests')}
                </label>
                <textarea
                  className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background"
                  placeholder={t('menuItem.specialRequestsPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}

            {/* Add to Cart Button */}
            <Button size="xl" className="w-full" onClick={handleAdd}>
              {t('menuItem.addToOrder', { price: displayPrice(item.price * quantity) })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
