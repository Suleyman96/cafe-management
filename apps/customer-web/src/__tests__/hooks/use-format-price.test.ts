import { renderHook } from '@testing-library/react';
import { useFormatPrice } from '@/hooks/use-format-price';
import { createWrapper, renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useFormatPrice', () => {
  it('formats using settings when loaded (currency after)', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.settings.get as any).mockResolvedValueOnce({
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

    const { result } = renderHook(() => useFormatPrice(), { wrapper });

    await waitFor(() => {
      const formatted = result.current(10.5);
      expect(formatted).toBe('10.50₼');
    });
  });

  it('formats using settings when loaded (currency before)', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.settings.get as any).mockResolvedValueOnce({
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

    const { result } = renderHook(() => useFormatPrice(), { wrapper });

    await waitFor(() => {
      const formatted = result.current(10.5);
      expect(formatted).toBe('$10.50');
    });
  });

  it('falls back to basic formatting when settings are not loaded', () => {
    // The shared useCafeSettings has no placeholderData, so settings are undefined initially.
    // useFormatPrice falls back to `$${amount.toFixed(2)}` when cafeSettings is undefined.
    const { result } = renderHookWithProviders(() => useFormatPrice());

    const formatted = result.current(10.5);
    expect(formatted).toBe('$10.50');
  });
});
