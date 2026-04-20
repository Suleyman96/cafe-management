import { renderHook } from '@testing-library/react';
import { useTaxMultiplier } from '@/hooks/use-tax-multiplier';
import { createWrapper, waitFor } from '../helpers/test-utils';

describe('useTaxMultiplier', () => {
  it('returns 1 when settings have tax disabled', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.settings.get as any).mockResolvedValueOnce({
      tax_enabled: false,
      tax_percentage: 18,
    });

    const { result } = renderHook(() => useTaxMultiplier(), { wrapper });

    await waitFor(() => expect(result.current).toBe(1));
  });

  it('returns tax multiplier when tax is enabled', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.settings.get as any).mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000001',
      tax_enabled: true,
      tax_percentage: 18,
      currency_symbol: '₼',
      currency_code: 'AZN',
      currency_position: 'after',
      currency_decimal_places: 2,
      prices_include_tax: false,
      restaurant_name: 'Test',
    });

    const { result } = renderHook(() => useTaxMultiplier(), { wrapper });

    await waitFor(() => expect(result.current).toBe(1.18));
  });

  it('returns 1 when tax_percentage is 0', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.settings.get as any).mockResolvedValueOnce({
      tax_enabled: true,
      tax_percentage: 0,
    });

    const { result } = renderHook(() => useTaxMultiplier(), { wrapper });

    await waitFor(() => expect(result.current).toBe(1));
  });
});
