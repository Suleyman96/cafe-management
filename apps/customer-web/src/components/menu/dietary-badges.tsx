'use client';

import { useTranslation } from '@gustri/i18n';
import { Flame, Leaf } from 'lucide-react';
import type { MenuItemWithCategory } from '@/types';

interface DietaryBadgesProps {
  item: MenuItemWithCategory;
  size: 'sm' | 'md';
}

const sizeClasses = {
  sm: {
    gap: 'gap-0.5',
    badge: 'px-1.5 py-0.5 text-[10px]',
    icon: 'h-2.5 w-2.5',
    font: '',
    bgOpacity: '0.1',
  },
  md: {
    gap: 'gap-1',
    badge: 'px-2.5 py-1 text-[11px]',
    icon: 'h-3 w-3',
    font: ' font-semibold',
    bgOpacity: '0.12',
  },
};

export function DietaryBadges({ item, size }: DietaryBadgesProps) {
  const { t } = useTranslation('customer');
  const s = sizeClasses[size];

  if (!item.is_vegetarian && !item.is_vegan && !item.is_spicy && !item.is_gluten_free) {
    return null;
  }

  return (
    <>
      {item.is_vegetarian && (
        <span
          className={`flex items-center ${s.gap} rounded-full ${s.badge}${s.font} text-green-400`}
          style={{
            background: `rgba(34,197,94,${s.bgOpacity})`,
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <Leaf className={s.icon} />
          {size === 'sm' ? t('menuItem.badgeVeg') : t('menuItem.badgeVegetarian')}
        </span>
      )}
      {item.is_vegan && (
        <span
          className={`flex items-center ${s.gap} rounded-full ${s.badge}${s.font} text-green-400`}
          style={{
            background: `rgba(34,197,94,${s.bgOpacity})`,
            border: '1px solid rgba(34,197,94,0.2)',
          }}
        >
          <Leaf className={s.icon} />
          {t('menuItem.badgeVegan')}
        </span>
      )}
      {item.is_spicy && (
        <span
          className={`flex items-center ${s.gap} rounded-full ${s.badge}${s.font} text-red-400`}
          style={{
            background: `rgba(239,68,68,${s.bgOpacity})`,
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <Flame className={s.icon} />
          {t('menuItem.badgeSpicy')}
        </span>
      )}
      {item.is_gluten_free && (
        <span
          className={`flex items-center ${s.gap} rounded-full ${s.badge}${s.font} text-amber-400`}
          style={{
            background: `rgba(217,119,6,${s.bgOpacity})`,
            border: '1px solid rgba(217,119,6,0.2)',
          }}
        >
          {t('menuItem.badgeGlutenFree')}
        </span>
      )}
    </>
  );
}
