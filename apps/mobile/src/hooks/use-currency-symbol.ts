import { useCafeSettings } from './use-cafe-settings';

export function useCurrencySymbol(): string {
  const { data: settings } = useCafeSettings();
  return settings?.currency_symbol || '$';
}
