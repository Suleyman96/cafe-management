import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Returns the active i18n language (e.g. `'tr'`, `'en'`, `'de'`).
 *
 * Use this when you need to format dates, numbers, or currencies so that
 * they follow the user's UI language — never the device default — to avoid
 * a Turkish-speaking user on an `en-US` phone seeing US-formatted dates.
 */
export function useLocale(): string {
  const { i18n } = useTranslation();
  return i18n.language;
}

/**
 * Locale-aware date formatter bound to the active i18n language.
 * Memoised so consumers can pass it directly to `.format(date)` without
 * recreating an `Intl.DateTimeFormat` on every render.
 */
export function useDateFormatter(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = useLocale();
  return useMemo(() => new Intl.DateTimeFormat(locale, options), [locale, options]);
}

/**
 * Locale-aware number formatter bound to the active i18n language.
 */
export function useNumberFormatter(options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = useLocale();
  return useMemo(() => new Intl.NumberFormat(locale, options), [locale, options]);
}

/**
 * Locale-aware currency formatter using ISO 4217 currency codes.
 *
 * Note: this uses `Intl.NumberFormat`'s built-in currency formatting, which
 * applies the *locale's* currency symbol conventions. Cafés that need a
 * custom symbol/position (e.g. Azerbaijani manat ₼) should use
 * `useFormatPrice` from `@gustri/queries` instead — that hook respects
 * the cafe settings while still using locale-aware digit grouping.
 */
export function useCurrencyFormatter(currency: string): Intl.NumberFormat {
  const locale = useLocale();
  return useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency }),
    [locale, currency],
  );
}
