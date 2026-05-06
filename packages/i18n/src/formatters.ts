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

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function englishWordsUnder1000(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)] ?? '';
    const rem = n % 10;
    return rem === 0 ? tens : `${tens}-${ONES[rem]}`;
  }
  const hundreds = ONES[Math.floor(n / 100)] ?? '';
  const rem = n % 100;
  return rem === 0 ? `${hundreds} hundred` : `${hundreds} hundred ${englishWordsUnder1000(rem)}`;
}

function englishWholeToWords(n: number): string {
  if (n === 0) return ONES[0] ?? 'zero';
  const parts: string[] = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (billions > 0) parts.push(`${englishWordsUnder1000(billions)} billion`);
  if (millions > 0) parts.push(`${englishWordsUnder1000(millions)} million`);
  if (thousands > 0) parts.push(`${englishWordsUnder1000(thousands)} thousand`);
  if (rest > 0) parts.push(englishWordsUnder1000(rest));
  return parts.join(' ');
}

/**
 * Render an amount in words for a confirm-step display ("two hundred and 00/100").
 *
 * Used as a friction layer alongside numeric currency on refund / discount
 * confirm screens. Only English is implemented in words; for any other
 * locale we fall back to the locale-aware numeric string from
 * `Intl.NumberFormat`. The actual safety guard (type-to-confirm input)
 * compares against the numeric amount, so non-English locales remain
 * fully protected — the words render is purely a visual cross-check.
 *
 * Negative amounts are normalized to absolute value: refund displays are
 * always non-negative in the UI; the sign is conveyed by context.
 */
export function numberToWords(amount: number, locale: string): string {
  const abs = Math.abs(amount);
  const lang = locale.split('-')[0]?.toLowerCase();
  if (lang === 'en') {
    const whole = Math.floor(abs);
    const cents = Math.round((abs - whole) * 100);
    const wholeWords = englishWholeToWords(whole);
    const padded = String(cents).padStart(2, '0');
    return `${wholeWords} and ${padded}/100`;
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
}
