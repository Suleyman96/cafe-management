import { useFormatPrice } from '@/hooks/use-format-price';
import { db } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useFormatPrice', () => {
  it('formats using settings when loaded (currency after)', async () => {
    (db.settings.get as any).mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000001',
      restaurant_name: 'Test',
      tax_enabled: true,
      tax_percentage: 18,
      currency_symbol: '₼',
      currency_code: 'AZN',
      currency_position: 'after',
      currency_decimal_places: 2,
      prices_include_tax: false,
    });

    const { result } = renderHookWithProviders(() => useFormatPrice());

    await waitFor(() => {
      const formatted = result.current(10.5);
      expect(formatted).toBe('10.50₼');
    });
  });

  it('formats using settings when loaded (currency before)', async () => {
    (db.settings.get as any).mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000001',
      restaurant_name: 'Test',
      tax_enabled: true,
      tax_percentage: 18,
      currency_symbol: '$',
      currency_code: 'USD',
      currency_position: 'before',
      currency_decimal_places: 2,
      prices_include_tax: false,
    });

    const { result } = renderHookWithProviders(() => useFormatPrice());

    await waitFor(() => {
      const formatted = result.current(10.5);
      expect(formatted).toBe('$10.50');
    });
  });

  it('uses DEFAULT_SETTINGS immediately via placeholderData', () => {
    // useCafeSettings has placeholderData: DEFAULT_SETTINGS, so settings are always available
    // DEFAULT_SETTINGS has currency_symbol: '₼', currency_position: 'after'
    const { result } = renderHookWithProviders(() => useFormatPrice());

    const formatted = result.current(10.5);
    expect(formatted).toBe('10.50₼');
  });
});
