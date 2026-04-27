'use client';

import { useTranslation } from '@gustri/i18n';
import { Clock, Plus, Star } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useTaxMultiplier } from '@/hooks/use-tax-multiplier';
import { getLocalizedField } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { useLanguageStore } from '@/store/language-store';
import type { MenuItemWithCategory } from '@/types';
import { DietaryBadges } from './dietary-badges';
import { MenuItemModal } from './menu-item-modal';

interface MenuItemCardProps {
  item: MenuItemWithCategory;
  accentColor: string;
  priority?: boolean;
}

export function MenuItemCard({ item, accentColor, priority = false }: MenuItemCardProps) {
  const { t } = useTranslation('customer');
  const addItem = useCartStore((state) => state.addItem);
  const [showModal, setShowModal] = useState(false);
  const { language } = useLanguageStore();
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();

  const name = getLocalizedField(item, 'name', language);
  const description = getLocalizedField(item, 'description', language);

  const displayPrice = (amount: number) => formatPrice(amount * taxMultiplier);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(item, 1);
    toast.success(t('menuItem.addedToCart', { count: 1, name }));
  };

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden cursor-pointer transition-all active:scale-[0.98]"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
        onClick={() => setShowModal(true)}
      >
        {/* Image Section */}
        <div className="relative aspect-video bg-white/[0.03]">
          {item.image_url ? (
            <>
              <Image
                src={item.image_url}
                alt={name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                priority={priority}
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl opacity-30">{item.category?.icon || '🍽️'}</span>
            </div>
          )}

          {/* Badges on image */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {item.is_popular && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md"
                style={{
                  background: `${accentColor}cc`,
                  color: '#0C0C0E',
                }}
              >
                <Star className="h-2.5 w-2.5" />
                {t('menuItem.badgePopular')}
              </span>
            )}
            {item.is_daily_special && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
                {t('menuItem.badgeTodaySpecial')}
              </span>
            )}
          </div>

          {/* Quick Add FAB */}
          <button
            data-testid="quick-add"
            onClick={handleQuickAdd}
            className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-lg transition-all active:scale-90 hover:shadow-xl"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              color: '#0C0C0E',
              boxShadow: `0 4px 12px ${accentColor}40`,
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-2.5">
          <h3 className="font-semibold text-[13px] text-white line-clamp-1">{name}</h3>
          {description && (
            <p className="text-xs text-white/40 line-clamp-1 mt-0.5">{description}</p>
          )}

          {/* Price + Prep time row */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-bold" style={{ color: accentColor }}>
              {displayPrice(item.price)}
            </span>
            {item.preparation_time && (
              <span className="flex items-center gap-1 text-[11px] text-white/30">
                <Clock className="h-3 w-3" />~{item.preparation_time} min
              </span>
            )}
          </div>

          {/* Dietary badges */}
          {(item.is_vegetarian || item.is_vegan || item.is_spicy || item.is_gluten_free) && (
            <div className="flex flex-wrap gap-1 mt-2">
              <DietaryBadges item={item} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <MenuItemModal
        item={item}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        accentColor={accentColor}
      />
    </>
  );
}
