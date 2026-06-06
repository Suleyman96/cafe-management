'use client';

import type { MenuItemOptionWithValues } from '@gustri/api-client';
import { useMenuItemOptions } from '@gustri/queries';
import { useEffect, useState } from 'react';
import type { MenuItemWithCategory, SelectedOption } from '@/types';

/** A single available option group (group + its available values). */
export type AvailableOptionGroup = MenuItemOptionWithValues;

/**
 * Modifier/option-group selection state + derived pricing/validation for the
 * menu-item modal (Phase 3). Owns the `selections` map, default pre-selection,
 * the single/multi toggle logic, and the derived `selectedOptions`, `unitPrice`
 * and `optionsValid` values. Extracted from `MenuItemModal` so the modal body
 * stays focused on layout — behavior is byte-identical to the inlined version.
 */
export function useMenuItemOptionsSelection(
  item: MenuItemWithCategory,
  options?: { enabled?: boolean },
) {
  // Modifier selections (Phase 3): optionId -> chosen value ids.
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  // ─── Modifiers (Phase 3) ────────────────────────────────────────
  // Perf: a `MenuItemModal` is mounted by every card in the grid, so the
  // options query must be gated on the modal actually being open — otherwise
  // a 200-item menu fires ~200 parallel option-group requests on first paint,
  // on the public weak-network entry point. The caller passes `isOpen`.
  const { data: optionGroups = [] } = useMenuItemOptions(item.id, {
    enabled: options?.enabled ?? true,
  });
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

  return {
    availableGroups,
    selections,
    toggleValue,
    selectedOptions,
    unitPrice,
    optionsValid,
  };
}
