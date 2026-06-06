'use client';

import { useTranslation } from '@gustri/i18n';
import type { AvailableOptionGroup } from './use-menu-item-options-selection';

interface MenuItemOptionGroupsProps {
  availableGroups: AvailableOptionGroup[];
  selections: Record<string, string[]>;
  toggleValue: (group: AvailableOptionGroup, valueId: string) => void;
  accentColor: string;
  displayPrice: (amount: number) => string;
}

/**
 * Modifier/option-group picker (Phase 3) for the menu-item modal. Pure
 * presentation: renders the available option groups and delegates selection
 * back to the parent's `toggleValue`. Markup/classNames/i18n keys are
 * byte-identical to the inlined block in `MenuItemModal`.
 */
export function MenuItemOptionGroups({
  availableGroups,
  selections,
  toggleValue,
  accentColor,
  displayPrice,
}: MenuItemOptionGroupsProps) {
  const { t } = useTranslation('customer');

  if (availableGroups.length === 0) return null;

  return (
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
                    background: checked ? `${accentColor}1f` : 'rgba(255,255,255,0.05)',
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
                    <span className="text-white/55">+{displayPrice(value.price_delta)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
