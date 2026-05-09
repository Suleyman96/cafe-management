'use client';

import { useTranslation } from '@gustri/i18n';
import type { HiddenCategoryBucket } from '@gustri/queries';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

/**
 * Coordination cue on each kitchen-order card: "+2 items at other
 * stations". Tap to expand a per-category breakdown so the kitchen lead
 * can see at a glance what's being prepared elsewhere on the same order.
 *
 * Renders nothing when there's nothing hidden — keeps cards tight in the
 * common show-all case.
 */
interface HiddenItemsSummaryProps {
  count: number;
  byCategory: HiddenCategoryBucket[];
}

export function HiddenItemsSummary({ count, byCategory }: HiddenItemsSummaryProps) {
  const { t } = useTranslation('staff');
  const [expanded, setExpanded] = useState(false);

  if (count === 0) return null;

  return (
    <div className="mt-2 px-2 py-1.5 rounded-lg bg-white/40 border border-white/60 text-gray-700">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 w-full text-left"
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span className="text-xs font-medium">{t('kitchen.filter.hiddenItems', { count })}</span>
      </button>
      {expanded && byCategory.length > 0 && (
        <ul className="mt-1.5 ml-5 space-y-0.5 text-xs">
          {byCategory.map((bucket) => (
            <li
              key={bucket.categoryId ?? '__uncategorized__'}
              className="flex justify-between gap-2 text-gray-600"
            >
              <span className="truncate">
                {bucket.categoryName ?? t('kitchen.filter.uncategorized')}
              </span>
              <span className="font-semibold flex-shrink-0">×{bucket.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
