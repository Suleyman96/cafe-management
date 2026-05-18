'use client';

import type { Category, MenuItem } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { useMemo, useState } from 'react';
import { MenuItemThumb } from '@/components/menu/menu-item-thumb';
import { useFormatPrice } from '@/hooks/use-format-price';

// Channel "accent" determines tab + hover colors. The takeout flow uses
// orange (matches the Package icon on /takeout); delivery uses purple
// (matches the Truck icon on /delivery). Tailwind needs the full class
// strings present in source for the JIT to pick them up, so each accent
// has a static lookup rather than `bg-${accent}-500` interpolation.
type AccentColor = 'orange' | 'purple';

const ACCENT_CLASSES: Record<
  AccentColor,
  {
    /** Horizontal pill — kept for tab-bar fallbacks (none in use today). */
    activeTab: string;
    /** Vertical sidebar tab — left border indicator + subtle accent bg. */
    activeSidebarTab: string;
    focusRing: string;
    hoverBorder: string;
    hoverBg: string;
  }
> = {
  orange: {
    activeTab: 'bg-orange-500 text-white shadow-sm',
    activeSidebarTab: 'bg-orange-50 text-orange-700 border-l-4 border-orange-500',
    focusRing: 'focus:ring-orange-500',
    hoverBorder: 'hover:border-orange-300',
    hoverBg: 'hover:bg-orange-50',
  },
  purple: {
    activeTab: 'bg-purple-500 text-white shadow-sm',
    activeSidebarTab: 'bg-purple-50 text-purple-700 border-l-4 border-purple-500',
    focusRing: 'focus:ring-purple-500',
    hoverBorder: 'hover:border-purple-300',
    hoverBg: 'hover:bg-purple-50',
  },
};

interface MenuItemPickerWithCategoriesProps {
  /** Items the channel CAN sell — caller is responsible for pre-filtering
   *  out non-takeoutable / non-deliverable items. The picker still hides
   *  `is_available=false` items via gray-disable, since that's transient. */
  menuItems: MenuItem[];
  categories: Category[];
  taxMultiplier: number;
  accent: AccentColor;
  onAddItem: (item: MenuItem) => void;
}

export function MenuItemPickerWithCategories({
  menuItems,
  categories,
  taxMultiplier,
  accent,
  onAddItem,
}: MenuItemPickerWithCategoriesProps) {
  const { t } = useTranslation('staff');
  const formatPrice = useFormatPrice();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const styles = ACCENT_CLASSES[accent];

  const categoryItemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of menuItems) {
      if (!item.category_id) continue;
      counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
    }
    return counts;
  }, [menuItems]);

  // Only show category tabs for categories that actually have eligible
  // items in this channel. Empty categories would just be dead tabs.
  const visibleCategories = useMemo(
    () => categories.filter((c) => (categoryItemCounts.get(c.id) ?? 0) > 0),
    [categories, categoryItemCounts],
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (selectedCategory && item.category_id !== selectedCategory) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [menuItems, searchQuery, selectedCategory]);

  return (
    <div>
      <h3 className="font-semibold text-lg mb-4">{t('orders.addItems')}</h3>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('orders.searchMenuItems')}
        className={`w-full px-4 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent ${styles.focusRing}`}
      />

      {/* Always-on left sidebar at every viewport — narrow on mobile to
          leave room for the items column, widens at sm:/md: for full
          category names. Pairs with the per-row stacked layout below
          (thumbnail | name above price) so the items column doesn't
          need to fit name + price side-by-side at narrow widths. */}
      <div className="flex gap-2 sm:gap-3">
        {visibleCategories.length > 0 && (
          // No aria-label on the nav — the surrounding <h3>{addItems}</h3>
          // already titles this region for assistive tech; a duplicate
          // label would announce "Add Items navigation" twice. The role
          // remains "navigation" by virtue of the <nav> tag, which gives
          // screen-reader users the ability to jump past it.
          <nav className="w-24 sm:w-32 md:w-44 shrink-0 max-h-96 overflow-y-auto border border-gray-200 rounded-lg py-1 bg-white">
            <button
              type="button"
              // aria-pressed turns the category buttons into toggle buttons
              // for assistive tech. Without it, screen readers can't tell
              // which category is currently filtering the items — the
              // visual left-border indicator is invisible to them.
              aria-pressed={selectedCategory === null}
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 transition-colors ${
                selectedCategory === null
                  ? styles.activeSidebarTab
                  : 'border-l-4 border-transparent text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="block truncate">
                {t('menu.allItems')}{' '}
                <span className="text-xs text-gray-400">({menuItems.length})</span>
              </span>
            </button>
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={selectedCategory === category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full text-left text-xs sm:text-sm font-medium px-2 sm:px-3 py-2 transition-colors ${
                  selectedCategory === category.id
                    ? styles.activeSidebarTab
                    : 'border-l-4 border-transparent text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="block truncate">
                  {category.icon || '📁'} {category.name}{' '}
                  <span className="text-xs text-gray-400">
                    ({categoryItemCounts.get(category.id) ?? 0})
                  </span>
                </span>
              </button>
            ))}
          </nav>
        )}

        <div className="flex-1 min-w-0 max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2 sm:p-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAddItem(item)}
              disabled={!item.is_available}
              className={`w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border transition-all text-left ${
                item.is_available
                  ? `border-gray-200 ${styles.hoverBorder} ${styles.hoverBg}`
                  : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <MenuItemThumb
                imageUrl={item.image_url}
                className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center"
                imageClassName={`w-full h-full object-cover ${item.is_available ? '' : 'grayscale'}`}
                fallbackClassName="text-xl sm:text-2xl opacity-40"
              />
              {/* Stacked name + price — frees the row from name-vs-price
                  horizontal competition at narrow widths. Name is the
                  primary, price the secondary visual; both truncate
                  defensively even though prices fit comfortably. */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm sm:text-base truncate">{item.name}</div>
                <div className="font-semibold text-sm text-gray-700 truncate">
                  {formatPrice(item.price * taxMultiplier)}
                </div>
                {!item.is_available && (
                  <div className="text-xs text-red-600">{t('orders.unavailable')}</div>
                )}
              </div>
            </button>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-gray-500">{t('orders.noItemsFound')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
