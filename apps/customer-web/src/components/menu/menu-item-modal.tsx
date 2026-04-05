'use client';

import { useTranslation } from '@gustri/i18n';
import { AlertCircle, Flame, Leaf, Minus, Plus, Star, X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTaxMultiplier } from '@/hooks/use-tax-multiplier';
import { useCartStore } from '@/store/cart-store';
import { useLanguageStore } from '@/store/language-store';
import { getLocalizedField, type MenuItemWithCategory } from '@/types';

interface MenuItemModalProps {
  item: MenuItemWithCategory;
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
}

export function MenuItemModal({ item, isOpen, onClose, accentColor }: MenuItemModalProps) {
  const { t } = useTranslation('customer');
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const { data: settings } = useCafeSettings();
  const { language } = useLanguageStore();

  const name = getLocalizedField(item, 'name', language);
  const description = getLocalizedField(item, 'description', language);

  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();

  const displayPrice = (amount: number) => formatPrice(amount * taxMultiplier);

  const handleAdd = () => {
    addItem(item, quantity, notes);
    toast.success(t('menuItem.addedToCart', { count: quantity, name }));
    onClose();
    setQuantity(1);
    setNotes('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #1A1A1E, #141416)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-white/15" />
          </div>

          {/* Close Button */}
          <button
            className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-md text-white/70 transition-all active:scale-95"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>

          {/* Image */}
          {item.image_url && (
            <div className="relative h-64 w-full">
              <Image src={item.image_url} alt={name} fill className="object-cover" unoptimized />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1E] via-transparent to-transparent" />
            </div>
          )}

          {/* Content */}
          <div className="px-5 pb-6" style={{ marginTop: item.image_url ? '-1rem' : '0.5rem' }}>
            {/* Title and Badges */}
            <div className="relative mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">{name}</h2>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {item.is_popular && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: `${accentColor}20`, color: accentColor }}
                  >
                    <Star className="h-3 w-3" />
                    {t('menuItem.badgePopular')}
                  </span>
                )}
                {item.is_vegetarian && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-green-400"
                    style={{
                      background: 'rgba(34,197,94,0.12)',
                      border: '1px solid rgba(34,197,94,0.2)',
                    }}
                  >
                    <Leaf className="h-3 w-3" />
                    {t('menuItem.badgeVegetarian')}
                  </span>
                )}
                {item.is_vegan && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-green-400"
                    style={{
                      background: 'rgba(34,197,94,0.12)',
                      border: '1px solid rgba(34,197,94,0.2)',
                    }}
                  >
                    <Leaf className="h-3 w-3" />
                    {t('menuItem.badgeVegan')}
                  </span>
                )}
                {item.is_spicy && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-red-400"
                    style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}
                  >
                    <Flame className="h-3 w-3" />
                    {t('menuItem.badgeSpicy')}
                  </span>
                )}
                {item.is_gluten_free && (
                  <span
                    className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-amber-400"
                    style={{
                      background: 'rgba(217,119,6,0.12)',
                      border: '1px solid rgba(217,119,6,0.2)',
                    }}
                  >
                    {t('menuItem.badgeGlutenFree')}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {description && (
              <p className="text-sm text-white/50 mb-4 leading-relaxed">{description}</p>
            )}

            {/* Allergens */}
            {item.allergens && item.allergens.length > 0 && (
              <div
                className="mb-4 p-3 rounded-xl"
                style={{
                  background: 'rgba(234,179,8,0.08)',
                  border: '1px solid rgba(234,179,8,0.15)',
                }}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-xs text-yellow-400">{t('menuItem.allergens')}</p>
                    <p className="text-xs text-yellow-400/70">{item.allergens.join(', ')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Prep Time */}
            {item.preparation_time && (
              <p className="text-xs text-white/30 mb-4">
                ⏱️ {t('menuItem.prepTimeFull', { count: item.preparation_time })}
              </p>
            )}

            {/* Price */}
            <div className="text-3xl font-bold mb-5" style={{ color: accentColor }}>
              {displayPrice(item.price)}
            </div>

            {/* Quantity Selector */}
            <div className="mb-4">
              <label className="text-xs font-medium text-white/50 mb-2 block">
                {t('menuItem.quantityLabel')}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-30"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <Minus className="h-4 w-4 text-white/70" />
                </button>
                <span className="text-2xl font-bold text-white w-12 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <Plus className="h-4 w-4 text-white/70" />
                </button>
              </div>
            </div>

            {/* Special Notes */}
            {settings?.allow_item_notes !== false && (
              <div className="mb-6">
                <label className="text-xs font-medium text-white/50 mb-2 block">
                  {t('menuItem.specialRequests')}
                </label>
                <textarea
                  className="w-full min-h-[80px] p-3 rounded-xl text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 transition-all resize-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  placeholder={t('menuItem.specialRequestsPlaceholder')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}

            {/* Add to Cart Button */}
            <button
              onClick={handleAdd}
              className="w-full rounded-2xl py-4 px-6 text-base font-semibold transition-all active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                color: '#0C0C0E',
                boxShadow: `0 8px 32px ${accentColor}30, 0 0 0 1px ${accentColor}40`,
              }}
            >
              {t('menuItem.addToOrder', { price: displayPrice(item.price * quantity) })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
