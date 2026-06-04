'use client';

import { useTranslation } from '@gustri/i18n';
import { useMenuItemOptions } from '@gustri/queries';
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
import type { MenuItemWithCategory, SelectedOption } from '@/types';
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
  // Modifier selections (Phase 3): optionId -> chosen value ids.
  const [selections, setSelections] = useState<Record<string, string[]>>({});
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

  // ─── Modifiers (Phase 3) ────────────────────────────────────────
  const { data: optionGroups = [] } = useMenuItemOptions(item.id);
  // Only offer available groups/values to customers.
  const availableGroups = optionGroups
    .filter((g) => g.is_available)
    .map((g) => ({ ...g, values: g.values.filter((v) => v.is_available) }))
    .filter((g) => g.values.length > 0);

  // Pre-select default values when the option set resolves / item changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on item + group count, not the derived array identity
  useEffect(() => {
    const defaults: Record<string, string[]> = {};
    for (const g of availableGroups) {
      const def = g.values.filter((v) => v.is_default).map((v) => v.id);
      if (def.length > 0) defaults[g.id] = g.selection_type === 'single' ? [def[0]] : def;
    }
    setSelections(defaults);
  }, [item.id, optionGroups.length]);

  const toggleValue = (group: (typeof availableGroups)[number], valueId: string) => {
    setSelections((prev) => {
      const cur = prev[group.id] ?? [];
      if (group.selection_type === 'single') {
        // Re-tapping a selected value clears it only when the group is optional.
        const next = cur.includes(valueId) && !group.is_required ? [] : [valueId];
        return { ...prev, [group.id]: next };
      }
      if (cur.includes(valueId)) return { ...prev, [group.id]: cur.filter((v) => v !== valueId) };
      if (group.max_select != null && cur.length >= group.max_select) return prev; // at cap
      return { ...prev, [group.id]: [...cur, valueId] };
    });
  };

  const selectedOptions: SelectedOption[] = availableGroups.flatMap((group) =>
    (selections[group.id] ?? []).flatMap((valueId) => {
      const value = group.values.find((v) => v.id === valueId);
      if (!value) return [];
      return [
        {
          optionId: group.id,
          optionName: group.name,
          valueId,
          valueName: value.name,
          priceDelta: Number(value.price_delta),
        },
      ];
    }),
  );

  const unitPrice = item.price + selectedOptions.reduce((sum, o) => sum + o.priceDelta, 0);

  // Required groups must meet their minimum; multi groups must respect max.
  const optionsValid = availableGroups.every((group) => {
    const n = (selections[group.id] ?? []).length;
    const min = group.is_required ? Math.max(1, group.min_select) : group.min_select;
    if (n < min) return false;
    if (group.max_select != null && n > group.max_select) return false;
    return true;
  });

  const handleAdd = () => {
    if (!optionsValid) return;
    addItem(item, quantity, notes, selectedOptions.length > 0 ? selectedOptions : undefined);
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
              {displayPrice(unitPrice)}
            </div>

            {addedCount === 0 ? (
              <>
                {/* Modifiers (Phase 3) */}
                {availableGroups.length > 0 && (
                  <div className="mb-5 space-y-4">
                    {availableGroups.map((group) => (
                      <div key={group.id}>
                        <div className="mb-2 flex items-baseline justify-between">
                          <span className="text-sm font-semibold text-white/85">{group.name}</span>
                          {group.is_required && (
                            <span className="text-[11px] uppercase tracking-wide text-white/40">
                              {t('required', { ns: 'common' })}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          {group.values.map((value) => {
                            const checked = (selections[group.id] ?? []).includes(value.id);
                            return (
                              <button
                                key={value.id}
                                type="button"
                                aria-pressed={checked}
                                onClick={() => toggleValue(group, value.id)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all active:scale-[0.99]"
                                style={{
                                  background: checked
                                    ? `${accentColor}1f`
                                    : 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${checked ? `${accentColor}66` : 'rgba(255,255,255,0.08)'}`,
                                }}
                              >
                                <span className="flex items-center gap-2.5">
                                  <span
                                    className={`flex h-4 w-4 items-center justify-center border ${
                                      group.selection_type === 'single' ? 'rounded-full' : 'rounded'
                                    }`}
                                    style={{
                                      borderColor: checked ? accentColor : 'rgba(255,255,255,0.3)',
                                    }}
                                  >
                                    {checked && (
                                      <span
                                        className={
                                          group.selection_type === 'single'
                                            ? 'h-2 w-2 rounded-full'
                                            : 'h-2.5 w-2.5 rounded-[2px]'
                                        }
                                        style={{ background: accentColor }}
                                      />
                                    )}
                                  </span>
                                  <span className="text-white/90">{value.name}</span>
                                </span>
                                {value.price_delta > 0 && (
                                  <span className="text-white/55">
                                    +{displayPrice(value.price_delta)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

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
                  disabled={!optionsValid}
                  className="w-full rounded-2xl py-4 px-6 text-base font-semibold transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                    color: '#0C0C0E',
                    boxShadow: `0 8px 32px ${accentColor}30, 0 0 0 1px ${accentColor}40`,
                  }}
                >
                  {optionsValid
                    ? t('menuItem.addToOrder', { price: displayPrice(unitPrice * quantity) })
                    : t('menuItem.selectRequiredOptions')}
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
