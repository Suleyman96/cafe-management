'use client';

import { useTranslation } from '@gustri/i18n';
import { Clock, Plus, Star } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';
import { Price } from '@/components/ui/price';
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
  /**
   * P5 — when the parent list has already localized the item (memoized
   * once per language per render in `MenuScreen`), pass the precomputed
   * values to skip the per-card `getLocalizedField` work. Standalone
   * uses (e.g. the modal preview) can still mount without them and
   * fall back to in-place localization.
   */
  localizedName?: string;
  localizedDescription?: string;
  /**
   * M2 — cart route to surface in the post-add "Go to cart" affordance.
   * Optional: when omitted the modal's confirmation strip falls back to
   * just "Add another", which is what tests / standalone mounts need.
   */
  cartHref?: string;
}

export function MenuItemCard({
  item,
  accentColor,
  priority = false,
  localizedName,
  localizedDescription,
  cartHref,
}: MenuItemCardProps) {
  const { t } = useTranslation('customer');
  const addItem = useCartStore((state) => state.addItem);
  const [showModal, setShowModal] = useState(false);
  const { language } = useLanguageStore();
  const taxMultiplier = useTaxMultiplier();

  const name = localizedName ?? getLocalizedField(item, 'name', language);
  const description = localizedDescription ?? getLocalizedField(item, 'description', language);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(item, 1);
    toast.success(t('menuItem.addedToCart', { count: 1, name }));
  };

  return (
    <>
      {/* The card-wide onClick is a pointer convenience. The keyboard /
          screen-reader path to the detail modal (where allergens + modifiers
          live) is the real <button> wrapping the item name below — making the
          whole div a `role="button"` would nest it with the quick-add <button>
          (invalid) and trip `useSemanticElements`. */}
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

          {/* Quick Add FAB — h-11 w-11 = 44×44, the WCAG 2.5.5 mobile
              tap-target minimum. The pre-PR `h-8 w-8` (32×32) was a real
              fat-finger hazard on phones; on a small two-up card grid
              the previous size was easy to mis-tap to the neighboring
              card. Inner icon stays at h-4 w-4 so the button reads
              visually subtle, just with a larger hit area. */}
          <button
            data-testid="quick-add"
            onClick={handleQuickAdd}
            aria-label={t('menuItem.addToCartA11y', { defaultValue: 'Add to cart' })}
            className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-all active:scale-90 hover:shadow-xl"
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
          {/* a11y — the focusable control that opens the detail modal for
              keyboard + screen-reader users (the card-wide onClick is mouse
              only). `stopPropagation` keeps it from double-firing the card
              onClick; `aria-haspopup="dialog"` announces that a dialog opens. */}
          <h3 className="font-semibold text-[13px] text-white line-clamp-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
              aria-haspopup="dialog"
              aria-label={t('menuItem.viewDetailsA11y', {
                defaultValue: 'View {{name}} details',
                name,
              })}
              className="text-left focus:outline-none focus-visible:underline"
            >
              {name}
            </button>
          </h3>
          {description && (
            <p className="text-xs text-white/55 line-clamp-1 mt-0.5">{description}</p>
          )}

          {/* Price + Prep time row */}
          <div className="flex items-center justify-between mt-2">
            {/* P4 — Skeleton swap while settings are placeholder so the
                currency symbol doesn't flicker from `$` to the real value
                on slow networks. */}
            <Price
              amount={item.price * taxMultiplier}
              className="text-sm font-bold"
              skeletonClassName="h-4 w-12 bg-white/[0.08]"
              style={{ color: accentColor }}
            />
            {item.preparation_time && (
              <span className="flex items-center gap-1 text-[11px] text-white/55">
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
        cartHref={cartHref}
      />
    </>
  );
}
