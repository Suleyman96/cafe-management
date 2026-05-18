'use client';

import { useTranslation } from '@gustri/i18n';
import { AlertCircle, Check, Clock, Minus, Plus, ShoppingCart, Star, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTaxMultiplier } from '@/hooks/use-tax-multiplier';
import { getLocalizedField } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { useLanguageStore } from '@/store/language-store';
import type { MenuItemWithCategory } from '@/types';
import { DietaryBadges } from './dietary-badges';

interface MenuItemModalProps {
  item: MenuItemWithCategory;
  isOpen: boolean;
  onClose: () => void;
  accentColor: string;
  // M5 — cart route for "Go to cart" from the post-add confirmation
  // strip. dine-in passes `/table/${tableId}/cart`, delivery passes
  // `/delivery/cart`. Optional so legacy callers that don't surface a
  // cart route keep working (the post-add strip falls back to closing
  // the modal).
  cartHref?: string;
}

export function MenuItemModal({
  item,
  isOpen,
  onClose,
  accentColor,
  cartHref,
}: MenuItemModalProps) {
  const { t } = useTranslation('customer');
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  // M2 — read post-add cart totals from the store so the confirmation
  // strip can advertise "Go to cart (₺Total · N items)" without a
  // round-trip through the parent.
  const cartItemCount = useCartStore((s) => s.getItemCount());
  const cartSubtotal = useCartStore((s) => s.getTotal());
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  // M2 — once we've added at-least one stack of this item, swap the
  // modal body for a "Added · keep shopping / Go to cart" strip so the
  // customer can rapid-fire more items without revisiting the cart.
  // `addedCount` reflects how many of *this* item the customer added
  // during the current modal session (sum across taps).
  const [addedCount, setAddedCount] = useState(0);
  const { data: settings } = useCafeSettings();
  const { language } = useLanguageStore();
  // A5 — focus trap + Esc to close + focus restoration on the menu-item
  // bottom sheet. `useId` gives a stable element id so aria-labelledby
  // can point at the title regardless of how many cards are mounted.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useFocusTrap(dialogRef, { active: isOpen, onClose });

  // Reset the post-add strip when the modal closes so the next mount
  // starts in the add-flow rather than the confirmation state.
  useEffect(() => {
    if (!isOpen) {
      setAddedCount(0);
      setQuantity(1);
      setNotes('');
    }
  }, [isOpen]);

  const name = getLocalizedField(item, 'name', language);
  const description = getLocalizedField(item, 'description', language);

  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();

  const displayPrice = (amount: number) => formatPrice(amount * taxMultiplier);
  const cartTotal = cartSubtotal * taxMultiplier;

  const handleAdd = () => {
    addItem(item, quantity, notes);
    // M2 — instead of closing on add, transition the modal to the
    // confirmation strip. The strip lets the customer return to the
    // menu (most common follow-up) or jump straight to the cart with
    // the current totals visible.
    setAddedCount((prev) => prev + quantity);
    setQuantity(1);
    setNotes('');
  };

  const handleAddAnother = () => {
    // Closes the modal and lets the customer pick a different item
    // from the menu. We deliberately keep `onClose` (not a no-op) so
    // the menu scroll position is preserved by the parent's modal
    // mount/unmount.
    onClose();
  };

  const handleGoToCart = () => {
    onClose();
    if (cartHref) router.push(cartHref);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl focus:outline-none"
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
              <Image
                src={item.image_url}
                alt={name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 512px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1E] via-transparent to-transparent" />
            </div>
          )}

          {/* Content */}
          <div className="px-5 pb-6" style={{ marginTop: item.image_url ? '-1rem' : '0.5rem' }}>
            {/* Title and Badges */}
            <div className="relative mb-4">
              <h2 id={titleId} className="text-2xl font-bold text-white mb-2">
                {name}
              </h2>
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
                <DietaryBadges item={item} size="md" />
              </div>
            </div>

            {/* Description */}
            {description && (
              <p className="text-sm text-white/70 mb-4 leading-relaxed">{description}</p>
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
                  {/* Y3 — chip-strip layout so long-locale translations
                      (DE/RU/TR) wrap cleanly on a 320 px viewport instead
                      of overflowing horizontally. Allergens are a safety
                      surface — every entry must remain readable, so we
                      flex-wrap rather than truncate. `min-w-0` lets the
                      flex child shrink to its parent. */}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-xs text-yellow-400 mb-1.5">
                      {t('menuItem.allergens')}
                    </p>
                    <ul className="flex flex-wrap gap-1.5">
                      {item.allergens.map((allergen) => (
                        <li
                          key={allergen}
                          className="rounded-full px-2 py-0.5 text-[11px] text-yellow-400/80 break-words"
                          style={{
                            background: 'rgba(234,179,8,0.12)',
                            border: '1px solid rgba(234,179,8,0.22)',
                          }}
                        >
                          {allergen}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Prep Time */}
            {item.preparation_time && (
              <p className="text-xs text-white/55 mb-4 inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {t('menuItem.prepTimeFull', { count: item.preparation_time })}
              </p>
            )}

            {/* Price */}
            <div className="text-3xl font-bold mb-5" style={{ color: accentColor }}>
              {displayPrice(item.price)}
            </div>

            {addedCount === 0 ? (
              <>
                {/* Quantity Selector */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-white/50 mb-2 block">
                    {t('menuItem.quantityLabel')}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      data-testid="modal-quantity-decrease"
                      aria-label={t('menuItem.quantityDecrease')}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      // MO2 — `opacity-30` alone is too subtle on dark glass.
                      // Combine an opacity drop, a darker background, a
                      // washed-out icon (`disabled:[&_svg]:text-white/30`)
                      // and `cursor-not-allowed` so the inactive state is
                      // unmistakable. Kill `active:scale-95` on disabled
                      // so a stuck tap doesn't read as "almost works."
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:bg-white/[0.02] disabled:cursor-not-allowed disabled:active:scale-100 disabled:[&_svg]:text-white/30"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <Minus className="h-4 w-4 text-white/70" />
                    </button>
                    <span className="text-2xl font-bold text-white w-12 text-center">
                      {quantity}
                    </span>
                    <button
                      data-testid="modal-quantity-increase"
                      aria-label={t('menuItem.quantityIncrease')}
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
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
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
              </>
            ) : (
              <>
                {/* M2 — confirmation strip. Replaces the close-on-add
                    behavior so the customer can keep shopping or jump
                    to the cart with one tap. The strip surfaces the
                    cart totals so they don't need to leave the modal
                    to verify what's been collected so far. */}
                <div
                  data-testid="menu-item-added-strip"
                  className="mb-4 flex items-center gap-3 rounded-2xl p-4"
                  style={{
                    background: `${accentColor}14`,
                    border: `1px solid ${accentColor}40`,
                  }}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${accentColor}30`, color: accentColor }}
                  >
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {t('menuItem.addedTitle', { count: addedCount, name })}
                    </p>
                    <p className="text-[11px] text-white/50">{t('menuItem.keepShoppingHint')}</p>
                  </div>
                </div>

                {/* Stack a quick "Add another of this item" affordance so a
                    customer who wants four of the same kebab doesn't have
                    to back out and re-open. Hidden on the second add for
                    this same modal session to avoid a runaway tap loop. */}
                <button
                  onClick={() => setAddedCount(0)}
                  className="mb-3 w-full rounded-2xl py-3 px-6 text-sm font-medium text-white/80 transition-all active:scale-[0.97]"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  + {t('menuItem.addAnotherOfSame')}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddAnother}
                    className="flex-1 rounded-2xl py-4 px-4 text-sm font-semibold text-white/80 transition-all active:scale-[0.97]"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    {t('menuItem.addAnother')}
                  </button>
                  {cartHref && (
                    <button
                      onClick={handleGoToCart}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 px-4 text-sm font-semibold transition-all active:scale-[0.97]"
                      style={{
                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                        color: '#0C0C0E',
                        boxShadow: `0 8px 32px ${accentColor}30, 0 0 0 1px ${accentColor}40`,
                      }}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span className="truncate">
                        {t('menuItem.goToCart', {
                          price: formatPrice(cartTotal),
                          count: cartItemCount,
                        })}
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
