'use client';

import { useTranslation } from '@gustri/i18n';
import type { ActiveKitchenFilter } from '@gustri/queries';
import { Filter } from 'lucide-react';

/**
 * Sticky pill at the top of the kitchen screen that always tells a cook
 * what they're looking at — "Showing all categories" or "Showing: Pizza,
 * Grill". Clicking opens the filter drawer.
 *
 * Designed for the dark kitchen header (white-on-dark). Stays visible
 * even when the order grid is empty, because the most common
 * confusion-source is a forgotten filter producing a blank screen.
 */
interface KitchenFilterBarProps {
  activeFilter: ActiveKitchenFilter;
  onOpen: () => void;
}

export function KitchenFilterBar({ activeFilter, onOpen }: KitchenFilterBarProps) {
  const { t } = useTranslation('staff');

  const label =
    activeFilter.mode === 'all'
      ? t('kitchen.filter.allCategories')
      : t('kitchen.filter.showingCategories', { names: activeFilter.names.join(', ') });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs sm:text-sm font-medium transition-colors max-w-full"
    >
      <Filter className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
