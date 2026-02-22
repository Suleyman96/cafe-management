'use client';

import { Flame, Leaf, Plus, Star } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice as formatPriceWithSettings, useCafeSettings } from '@/hooks/use-settings';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { useLanguageStore } from '@/store/language-store';
import { getLocalizedField, type MenuItemWithCategory } from '@/types';
import { MenuItemModal } from './menu-item-modal';

interface MenuItemCardProps {
  item: MenuItemWithCategory;
}

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { language } = useLanguageStore();
  const addItem = useCartStore((state) => state.addItem);
  const [showModal, setShowModal] = useState(false);
  const { data: settings } = useCafeSettings();

  const name = getLocalizedField(item, 'name', language);
  const description = getLocalizedField(item, 'description', language);

  // Format price using cafe settings or fallback
  const displayPrice = (amount: number) => {
    if (settings) {
      return formatPriceWithSettings(amount, settings);
    }
    return formatPrice(amount);
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(item, 1);
  };

  return (
    <>
      <div
        className="bg-card rounded-lg overflow-hidden shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        {/* Image */}
        {item.image_url && (
          <div className="relative h-40 w-full bg-muted">
            <Image src={item.image_url} alt={name} fill className="object-cover" />
            {/* Badges on image */}
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {item.is_popular && (
                <Badge variant="warning" className="backdrop-blur-sm">
                  <Star className="h-3 w-3 mr-1" />
                  Popular
                </Badge>
              )}
              {item.is_daily_special && (
                <Badge variant="success" className="backdrop-blur-sm">
                  Today's Special
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-semibold text-lg line-clamp-1">{name}</h3>
              {description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{description}</p>
              )}
            </div>
          </div>

          {/* Icons for dietary info */}
          <div className="flex gap-2 mb-3">
            {item.is_vegetarian && (
              <Badge variant="outline" className="text-xs">
                <Leaf className="h-3 w-3 mr-1 text-green-600" />
                Veg
              </Badge>
            )}
            {item.is_spicy && (
              <Badge variant="outline" className="text-xs">
                <Flame className="h-3 w-3 mr-1 text-red-600" />
                Spicy
              </Badge>
            )}
          </div>

          {/* Price and Add Button */}
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-primary">{displayPrice(item.price)}</span>
            <Button size="sm" onClick={handleQuickAdd} className="touch-target">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Prep time */}
          {item.preparation_time && (
            <p className="text-xs text-muted-foreground mt-2">⏱️ ~{item.preparation_time} min</p>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <MenuItemModal item={item} isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
