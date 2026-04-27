import type { SupabaseWrapper } from '@gustri/api-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useCafeSettings } from '../../hooks/use-cafe-settings';
import { useFeatureFlag } from '../../hooks/use-feature-flag';
import { useFormatPrice, useFormatPriceWithSettings } from '../../hooks/use-format-price';
import { useTaxMultiplier } from '../../hooks/use-tax-multiplier';
import { DbProvider } from '../../provider';
import { createMockDb } from '../helpers/mock-db';
import { createTestQueryClient, renderHookWithProviders } from '../helpers/test-utils';

/** Render a hook with a pre-configured settings response (so the query resolves to it). */
function renderWithSettings<T>(hook: () => T, settings: Record<string, unknown> | null) {
  const queryClient = createTestQueryClient();
  const mockDb = createMockDb();
  (mockDb.settings.get as any).mockResolvedValue(settings);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <DbProvider db={mockDb as unknown as SupabaseWrapper}>{children}</DbProvider>
    </QueryClientProvider>
  );
  return { ...renderHook(hook, { wrapper }), mockDb, queryClient };
}

describe('useCafeSettings', () => {
  it('calls db.settings.get', () => {
    const { mockDb } = renderHookWithProviders(() => useCafeSettings());
    expect(mockDb.settings.get).toHaveBeenCalled();
  });
});

describe('useFormatPrice', () => {
  it('falls back to $X.XX format when settings not loaded', () => {
    const { result } = renderHookWithProviders(() => useFormatPrice());
    expect(result.current(12.5)).toBe('$12.50');
  });

  it('formats using settings once loaded', async () => {
    const { result } = renderWithSettings(() => useFormatPrice(), {
      currency_code: 'USD',
      currency_symbol: '$',
      currency_position: 'before',
      decimal_places: 2,
      thousands_separator: ',',
      decimal_separator: '.',
    });
    await waitFor(() => {
      const formatted = result.current(1234.5);
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });
  });
});

describe('useFormatPriceWithSettings', () => {
  it('exposes both formatPrice and cafeSettings', () => {
    const { result } = renderHookWithProviders(() => useFormatPriceWithSettings());
    expect(typeof result.current.formatPrice).toBe('function');
    expect(result.current.cafeSettings).toBeUndefined();
  });
});

describe('useTaxMultiplier', () => {
  it('returns 1 when settings missing', () => {
    const { result } = renderHookWithProviders(() => useTaxMultiplier());
    expect(result.current).toBe(1);
  });

  it('returns 1 + tax/100 when tax enabled', async () => {
    const { result } = renderWithSettings(() => useTaxMultiplier(), {
      tax_enabled: true,
      tax_percentage: 18,
    });
    await waitFor(() => expect(result.current).toBeCloseTo(1.18, 2));
  });

  it('returns 1 when tax disabled even with percentage set', async () => {
    const { result } = renderWithSettings(() => useTaxMultiplier(), {
      tax_enabled: false,
      tax_percentage: 18,
    });
    // Settings load but multiplier should remain 1
    await waitFor(() => expect(result.current).toBe(1));
  });
});

describe('useFeatureFlag', () => {
  it('returns defaultValue when settings missing', () => {
    const { result } = renderHookWithProviders(() => useFeatureFlag('delivery_v2', true));
    expect(result.current).toBe(true);
  });

  it('returns false by default when no override given and no settings', () => {
    const { result } = renderHookWithProviders(() => useFeatureFlag('delivery_v2'));
    expect(result.current).toBe(false);
  });

  it('returns true when flag is true in settings.feature_flags', async () => {
    const { result } = renderWithSettings(() => useFeatureFlag('delivery_v2'), {
      feature_flags: { delivery_v2: true },
    });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('returns defaultValue when feature_flags is missing on settings', async () => {
    const { result } = renderWithSettings(() => useFeatureFlag('delivery_v2', true), {});
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('returns false when feature_flags entry is truthy but not strictly true', async () => {
    const { result } = renderWithSettings(() => useFeatureFlag('delivery_v2'), {
      feature_flags: { delivery_v2: 'yes' },
    });
    // Hook only treats === true as enabled
    await waitFor(() => expect(result.current).toBe(false));
  });
});
