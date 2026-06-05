'use client';

import type { Category } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { useReplaceStaffKitchenFilters, useStaffKitchenFilters } from '@gustri/queries';
import { Filter } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BaseModal } from '@/components/ui/base-modal';

/**
 * Modal that lets a staff member pick which menu categories appear on
 * THIS kitchen screen. Toggling a chip is committed immediately — no
 * Apply button — because a stressed cook should not have to confirm a
 * trivially reversible UX preference. The mutation is optimistic; the
 * realtime echo on `staff_kitchen_filters` (filtered by staff_id) brings
 * other devices logged in as the same staff into sync within one
 * trailing-debounce window.
 *
 * The "Show all categories" button clears the filter — no rows in the
 * table = the kitchen view's "show all" mode.
 */
interface KitchenFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  categories: Category[];
}

export function KitchenFilterDrawer({
  isOpen,
  onClose,
  staffId,
  categories,
}: KitchenFilterDrawerProps) {
  const { t } = useTranslation('staff');
  const { data: filterCategoryIds } = useStaffKitchenFilters(staffId);
  const replace = useReplaceStaffKitchenFilters();

  // Local working set so toggles feel instant even before the optimistic
  // cache update settles. Resyncs whenever the underlying query data
  // changes (realtime echo, drawer reopen) so the chips never lie about
  // server state.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(filterCategoryIds ?? []));

  useEffect(() => {
    setSelected(new Set(filterCategoryIds ?? []));
  }, [filterCategoryIds]);

  const toggle = (categoryId: string) => {
    const next = new Set(selected);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    setSelected(next);
    replace.mutate({ staffId, categoryIds: [...next] });
  };

  const clearAll = () => {
    setSelected(new Set());
    replace.mutate({ staffId, categoryIds: [] });
  };

  const sortedCategories = [...categories].sort((a, b) => {
    if (a.display_order !== b.display_order) return a.display_order - b.display_order;
    return a.name.localeCompare(b.name);
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('kitchen.filter.title')}
      icon={<Filter className="h-5 w-5 text-gray-700" />}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={clearAll}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            {t('kitchen.filter.clear')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-lg"
          >
            {t('kitchen.filter.done')}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 mb-4">{t('kitchen.filter.subtitle')}</p>
      {sortedCategories.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{t('kitchen.filter.noCategoriesYet')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {sortedCategories.map((category) => {
            const isSelected = selected.has(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggle(category.id)}
                aria-pressed={isSelected}
                className={
                  isSelected
                    ? 'px-3 py-2 rounded-full text-sm font-semibold bg-gray-900 text-white border-2 border-gray-900 transition-colors'
                    : 'px-3 py-2 rounded-full text-sm font-medium bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-500 transition-colors'
                }
              >
                {category.name}
              </button>
            );
          })}
        </div>
      )}
    </BaseModal>
  );
}
