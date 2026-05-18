'use client';

import { useTranslation } from '@gustri/i18n';
import {
  ArrowLeft,
  Check,
  Filter,
  Flame,
  Leaf,
  Search,
  ShoppingCart,
  UtensilsCrossed,
  Wheat,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActiveOrderBanner } from '@/components/order/active-order-banner';
import { useCartMenuSync } from '@/hooks/use-cart-menu-sync';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCategories, useMenuItems } from '@/hooks/use-menu';
import { useOrder } from '@/hooks/use-order';
import { useOrderEta } from '@/hooks/use-order-eta';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { useTaxMultiplier } from '@/hooks/use-tax-multiplier';
import { GLASS } from '@/lib/styles';
import { cn, getLocalizedField } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { useLanguageStore } from '@/store/language-store';
import type { Category, MenuItemWithCategory } from '@/types';
import { MenuCartSidebar } from './menu-cart-sidebar';
import { MenuItemCard } from './menu-item-card';

// M5 — dine-in only. Extracted so we don't fire `useTable` / `useOrder`
// in the delivery flow (the table sentinel `__delivery__` would 404 and
// pollute Sentry). The parent mounts this conditionally based on
// `isDelivery`.
function MenuActiveOrderBanner({ tableId }: { tableId: string }) {
  const { data: table } = useTable(tableId);
  const actualTableId = table?.id || '';
  const { data: existingOrder } = useOrder(actualTableId);
  const eta = useOrderEta(
    existingOrder?.order_items,
    existingOrder?.status,
    existingOrder?.created_at,
    existingOrder?.id,
  );
  if (!existingOrder?.order_number) return null;
  return (
    <ActiveOrderBanner
      orderNumber={existingOrder.order_number}
      href={`/table/${tableId}/order`}
      eta={eta}
    />
  );
}

interface MenuScreenProps {
  tableId: string;
  initialCategories?: Category[];
  initialMenuItems?: MenuItemWithCategory[];
}

type DietaryFilter = 'vegetarian' | 'vegan' | 'gluten_free' | 'spicy';

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="aspect-video bg-white/[0.06]" />
      <div className="p-3">
        <div className="h-3.5 w-3/4 rounded bg-white/[0.08] mb-2" />
        <div className="h-3 w-1/2 rounded bg-white/[0.06] mb-2.5" />
        <div className="h-4 w-1/3 rounded bg-white/[0.08]" />
      </div>
    </div>
  );
}

// ─── Main Menu Screen ───────────────────────────────────────────────────────

export function MenuScreen({ tableId, initialCategories, initialMenuItems }: MenuScreenProps) {
  const router = useRouter();
  const { t } = useTranslation('customer');
  const { language } = useLanguageStore();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilters, setDietaryFilters] = useState<DietaryFilter[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const { data: categories, isLoading: categoriesLoading } = useCategories(
    initialCategories ? { initialData: initialCategories } : undefined,
  );
  const { data: menuItems, isLoading: itemsLoading } = useMenuItems(
    selectedCategory,
    initialMenuItems && !selectedCategory ? { initialData: initialMenuItems } : undefined,
  );
  const { data: settings } = useCafeSettings();

  // H3 — drop cart items that the live menu no longer offers (item
  // disabled/deleted between sessions). Without this the customer
  // sees a generic "Something went wrong" on submit because the
  // server-side `is_available`/RLS check rejects without identifying
  // the offending row.
  useCartMenuSync();

  const storeItemCount = useCartStore((state) => state.getItemCount());
  const cartSubtotal = useCartStore((s) => s.getTotal());
  const [itemCount, setItemCount] = useState(0);
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();
  // M3 — ref on the bottom cart section so the header icon can scroll
  // it into view. Without this, first-time visitors who tap an item
  // and back out of the modal have no visible cart affordance until
  // they add something — discovery gap that hurts conversion.
  const cartSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setItemCount(storeItemCount);
  }, [storeItemCount]);

  const scrollCartIntoView = () => {
    // Only meaningful when the cart section is mounted (i.e. items > 0).
    // With no items the icon's primary role is *discovery* — the empty
    // tap is a no-op rather than a jarring scroll-to-nothing.
    cartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  // Auto-select first category (no "All" option)
  useEffect(() => {
    if (categories?.length && selectedCategory === undefined) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  const accentColor = settings?.brand_primary_color || '#C8A97E';
  const isLoading = categoriesLoading || itemsLoading;
  const hasCartItems = itemCount > 0;

  // M2 — cart route surfaced in the post-add confirmation strip. The
  // sentinel `__delivery__` keeps `MenuScreen` flow-agnostic; flipping
  // it here once instead of leaking the check into the modal/card.
  const isDelivery = tableId === '__delivery__';
  const cartHref = isDelivery ? '/delivery/cart' : `/table/${tableId}/cart`;

  // M3 — minimum-order chip on the menu header. Surfaces the threshold
  // *before* the customer invests in adding items. Delivery and dine-in
  // read different settings columns (`minimum_delivery_amount` vs
  // `minimum_order_amount`) but the chip UX is identical. The
  // tax-inclusive total mirrors the cart-side calc so the customer
  // sees the same number as the cart summary, not a pre-tax mismatch.
  const minimumAmount = isDelivery
    ? settings?.minimum_delivery_amount
    : settings?.minimum_order_amount;
  const currentTotal = cartSubtotal * taxMultiplier;
  const minimumMet = !minimumAmount || currentTotal >= minimumAmount;
  const showMinimumChip = Boolean(minimumAmount && minimumAmount > 0);

  // P3 — input stays controlled with raw `searchQuery` for responsive
  // typing; the filter consumes the debounced value so a 200-item menu
  // doesn't re-run `getLocalizedField` per keystroke on cheap Android.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 200);

  // P5 — localize name+description once per item per language render
  // pass instead of twice per item per keystroke. Two consumers (search
  // filter + card render) share the augmented entry. Keyed on `language`
  // so a language switch invalidates the cache without re-fetching.
  const localizedItems = useMemo(() => {
    if (!menuItems) return [];
    return menuItems.map((item) => ({
      item,
      name: getLocalizedField(item, 'name', language),
      description: getLocalizedField(item, 'description', language),
    }));
  }, [menuItems, language]);

  const filteredItems = useMemo(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    return localizedItems.filter(({ item, name, description }) => {
      if (query) {
        if (!name.toLowerCase().includes(query) && !description.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (dietaryFilters.length > 0) {
        if (dietaryFilters.includes('vegetarian') && !item.is_vegetarian) return false;
        if (dietaryFilters.includes('vegan') && !item.is_vegan) return false;
        if (dietaryFilters.includes('gluten_free') && !item.is_gluten_free) return false;
        if (dietaryFilters.includes('spicy') && !item.is_spicy) return false;
      }

      return true;
    });
  }, [localizedItems, debouncedSearchQuery, dietaryFilters]);

  const toggleDietaryFilter = (filter: DietaryFilter) => {
    setDietaryFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter],
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDietaryFilters([]);
    setShowFilters(false);
  };

  const hasActiveFilters = searchQuery || dietaryFilters.length > 0;

  return (
    <div className="h-[100svh] flex flex-col overflow-hidden bg-[#0C0C0E]">
      {/* Sticky Header */}
      <div
        className="flex-shrink-0"
        style={{
          background: 'rgba(12,12,14,0.92)',
          borderBottom: `1px solid ${GLASS.border}`,
        }}
      >
        {/* Top Row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t('back', { ns: 'common' })}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </button>

          <h1 className="text-base font-semibold text-white truncate mx-3">
            {settings?.restaurant_name || t('menu.title')}
          </h1>

          {/* M3 — persistent cart affordance. Empty: circular icon-only
              button (discovery). With items: expands to a pill showing
              count + running total so the customer sees what they're
              about to commit to before opening the cart (CV2). Empty tap
              is a no-op rather than gate-keeping the flow. */}
          <button
            type="button"
            onClick={scrollCartIntoView}
            aria-label={
              hasCartItems
                ? t('menu.viewCartWithTotal', {
                    count: itemCount,
                    price: formatPrice(currentTotal),
                  })
                : t('menu.viewCart', { count: itemCount })
            }
            className={cn(
              'flex h-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 transition-all active:scale-95',
              hasCartItems ? 'gap-1.5 pl-2 pr-3' : 'w-9',
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            {hasCartItems && (
              <span className="flex items-center gap-1 text-[11px] font-semibold leading-none">
                <span
                  className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-black"
                  style={{ background: accentColor }}
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
                {/* Hide the price on <360px viewports so the header
                    doesn't squeeze the restaurant name to one truncated
                    glyph. The count badge stays visible at all widths. */}
                <span className="hidden min-[360px]:inline text-white">
                  {formatPrice(currentTotal)}
                </span>
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/55" />
            <input
              type="text"
              placeholder={t('menu.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-24 py-2.5 rounded-xl text-sm text-white placeholder:text-white/55 focus:outline-none focus:ring-1 transition-all"
              style={{
                background: GLASS.border,
                border: `1px solid ${GLASS.light}`,
                ...(searchQuery
                  ? { borderColor: `${accentColor}40`, boxShadow: `0 0 0 1px ${accentColor}20` }
                  : {}),
              }}
            />
            {/* A1 — 44×44 hit area wrappers; visual chip stays compact so the
                search bar doesn't grow vertically. Tap target overshoots the
                input bounds slightly which is acceptable for icon affordances
                on the trailing edge. */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('menu.clearSearchAria')}
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/50">
                    <X className="h-3 w-3" />
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                aria-label={t('menu.toggleFiltersAria')}
                aria-pressed={showFilters}
                className="flex h-11 w-11 items-center justify-center"
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                    dietaryFilters.length > 0 ? '' : 'text-white/55',
                  )}
                  style={
                    dietaryFilters.length > 0
                      ? { backgroundColor: `${accentColor}20`, color: accentColor }
                      : { backgroundColor: GLASS.border }
                  }
                >
                  <Filter className="h-3.5 w-3.5" />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* M5 — active-order banner. Tells the customer their next
            Place Order tap will append to the in-flight order rather
            than mint a new one. Dine-in only; the delivery flow has no
            per-tableId concept of active order. */}
        {!isDelivery && (
          <div className="px-4 pb-2">
            <MenuActiveOrderBanner tableId={tableId} />
          </div>
        )}

        {/* M3 — minimum-order chip. Renders persistently below the
            search bar so the threshold is visible before the customer
            adds their first item. When the cart crosses the threshold
            the chip flips to a checkmark variant so the customer gets
            positive confirmation they can place the order. */}
        {showMinimumChip && minimumAmount != null && (
          <div className="px-4 pb-2">
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={
                minimumMet
                  ? {
                      background: 'rgba(34,197,94,0.10)',
                      color: '#4ade80',
                      border: '1px solid rgba(34,197,94,0.25)',
                    }
                  : {
                      background: 'rgba(234,179,8,0.10)',
                      color: '#facc15',
                      border: '1px solid rgba(234,179,8,0.25)',
                    }
              }
            >
              {minimumMet ? (
                <>
                  <Check className="h-3 w-3" />
                  <span>{t('menu.minimumChipMet')}</span>
                </>
              ) : (
                <span>
                  {t('menu.minimumChipBelow', {
                    min: formatPrice(minimumAmount),
                    current: formatPrice(currentTotal),
                  })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Dietary Filters (collapsible) */}
        {showFilters && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {[
              {
                key: 'vegetarian' as DietaryFilter,
                icon: Leaf,
                color: '#22c55e',
                label: t('menu.filterVegetarian'),
              },
              {
                key: 'vegan' as DietaryFilter,
                icon: Leaf,
                color: '#16a34a',
                label: t('menu.filterVegan'),
              },
              {
                key: 'gluten_free' as DietaryFilter,
                icon: Wheat,
                color: '#d97706',
                label: t('menu.filterGlutenFree'),
              },
              {
                key: 'spicy' as DietaryFilter,
                icon: Flame,
                color: '#ef4444',
                label: t('menu.filterSpicy'),
              },
            ].map(({ key, icon: Icon, color, label }) => {
              const isActive = dietaryFilters.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleDietaryFilter(key)}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95',
                    isActive ? 'text-white' : 'text-white/50',
                  )}
                  style={{
                    background: isActive ? `${color}25` : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isActive ? `${color}50` : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <Icon className="h-3 w-3" style={{ color }} />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* Active Filters Indicator */}
        {hasActiveFilters && !isLoading && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <span className="text-xs text-white/55">
              {t('menu.itemsFound', { count: filteredItems.length })}
            </span>
            <button
              onClick={clearFilters}
              className="text-xs font-medium px-2 py-0.5 rounded-full transition-all active:scale-95"
              style={{ color: accentColor, background: `${accentColor}15` }}
            >
              {t('menu.clearFilters')}
            </button>
          </div>
        )}
      </div>

      {/* Menu — top section (categories sidebar + items grid) */}
      <div
        className={`flex min-h-0 overflow-hidden ${hasCartItems ? 'h-[45%] flex-shrink-0' : 'flex-1'}`}
      >
        {/* Category Sidebar */}
        <div
          className="flex-shrink-0 overflow-y-auto"
          style={{ borderRight: `1px solid ${GLASS.border}` }}
        >
          <nav className="w-24 sm:w-28 lg:w-40 px-1.5 lg:px-2 py-3 space-y-1">
            {categories?.map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl text-xs font-medium transition-all active:scale-95"
                style={
                  selectedCategory === category.id
                    ? { background: `${accentColor}20`, color: accentColor }
                    : { color: 'rgba(255,255,255,0.5)' }
                }
              >
                <span className="text-base flex-shrink-0">{category.icon || '📋'}</span>
                <span className="truncate">{category.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 min-w-0 overflow-y-auto px-3 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : filteredItems.length > 0 ? (
              filteredItems.map(({ item, name, description }, index) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  localizedName={name}
                  localizedDescription={description}
                  accentColor={accentColor}
                  // P7 — first 2 cards cover the first row above the fold
                  // on most viewports (2-col mobile / 4-col desktop). The
                  // pre-fix `index < 4` preloaded a second row on 2-col
                  // grids and the entire above-the-fold row on 4-col
                  // grids, wasting Largest Contentful Paint budget on
                  // images the user never sees.
                  priority={index < 2}
                  cartHref={cartHref}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-16">
                {/* Y2 — Lucide icons replace emoji empty-states. Emoji
                    glyphs vary by font and announce as Unicode names. */}
                <div className="mb-3 flex justify-center text-white/55">
                  {hasActiveFilters ? (
                    <Search className="h-10 w-10" aria-hidden="true" />
                  ) : (
                    <UtensilsCrossed className="h-10 w-10" aria-hidden="true" />
                  )}
                </div>
                <p className="text-white/50 text-sm mb-4">
                  {hasActiveFilters ? t('menu.noItemsFiltered') : t('menu.noItemsAvailable')}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm font-medium px-4 py-2 rounded-full transition-all active:scale-95"
                    style={{
                      background: `${accentColor}15`,
                      color: accentColor,
                      border: `1px solid ${accentColor}30`,
                    }}
                  >
                    {t('menu.clearFilters')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cart — bottom section */}
      {hasCartItems && (
        <div
          ref={cartSectionRef}
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1A1A1E, #141416)',
            borderTop: `1px solid ${GLASS.light}`,
          }}
        >
          <MenuCartSidebar tableId={tableId} accentColor={accentColor} />
        </div>
      )}
    </div>
  );
}
