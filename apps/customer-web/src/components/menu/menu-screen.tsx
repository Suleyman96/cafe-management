'use client';

import { useTranslation } from '@gustri/i18n';
import { ArrowLeft, Filter, Flame, Leaf, Search, Wheat, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useCategories, useMenuItems } from '@/hooks/use-menu';
import { useCafeSettings } from '@/hooks/use-settings';
import { GLASS } from '@/lib/styles';
import { cn, getLocalizedField } from '@/lib/utils';
import { useCartStore } from '@/store/cart-store';
import { useLanguageStore } from '@/store/language-store';
import type { Category, MenuItemWithCategory } from '@/types';
import { MenuCartSidebar } from './menu-cart-sidebar';
import { MenuItemCard } from './menu-item-card';

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

  const storeItemCount = useCartStore((state) => state.getItemCount());
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setItemCount(storeItemCount);
  }, [storeItemCount]);

  // Auto-select first category (no "All" option)
  useEffect(() => {
    if (categories?.length && selectedCategory === undefined) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  const accentColor = settings?.brand_primary_color || '#C8A97E';
  const isLoading = categoriesLoading || itemsLoading;
  const hasCartItems = itemCount > 0;

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];

    return menuItems.filter((item) => {
      if (searchQuery) {
        const name = getLocalizedField(item, 'name', language).toLowerCase();
        const description = getLocalizedField(item, 'description', language).toLowerCase();
        const query = searchQuery.toLowerCase();
        if (!name.includes(query) && !description.includes(query)) return false;
      }

      if (dietaryFilters.length > 0) {
        if (dietaryFilters.includes('vegetarian') && !item.is_vegetarian) return false;
        if (dietaryFilters.includes('vegan') && !item.is_vegan) return false;
        if (dietaryFilters.includes('gluten_free') && !item.is_gluten_free) return false;
        if (dietaryFilters.includes('spicy') && !item.is_spicy) return false;
      }

      return true;
    });
  }, [menuItems, searchQuery, dietaryFilters, language]);

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
    <div className="h-screen flex flex-col overflow-hidden bg-[#0C0C0E]">
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
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.08] text-white/70 transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <h1 className="text-base font-semibold text-white truncate mx-3">
            {settings?.restaurant_name || t('menu.title')}
          </h1>

          <div className="w-9" />
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <input
              type="text"
              placeholder={t('menu.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-16 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 transition-all"
              style={{
                background: GLASS.border,
                border: `1px solid ${GLASS.light}`,
                ...(searchQuery
                  ? { borderColor: `${accentColor}40`, boxShadow: `0 0 0 1px ${accentColor}20` }
                  : {}),
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/50"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg transition-all',
                  dietaryFilters.length > 0 ? '' : 'text-white/40',
                )}
                style={
                  dietaryFilters.length > 0
                    ? { backgroundColor: `${accentColor}20`, color: accentColor }
                    : { backgroundColor: GLASS.border }
                }
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

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
            <span className="text-xs text-white/40">
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
              filteredItems.map((item, index) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  accentColor={accentColor}
                  priority={index < 4}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-16">
                <div className="text-4xl mb-3">{hasActiveFilters ? '🔍' : '🍽️'}</div>
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
