import { QUERY_KEYS } from '@gustri/queries';
import {
  type CafeSettings,
  calculateTax,
  calculateTotal,
  formatPrice,
  getDisplaySubtotal,
  useCafeSettings,
} from '@/hooks/use-settings';
import { db } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

const makeSettings = (overrides: Partial<CafeSettings> = {}): CafeSettings => ({
  id: '00000000-0000-0000-0000-000000000001',
  tenant_id: '00000000-0000-0000-0000-000000000000',
  restaurant_name: 'Test Cafe',
  tax_enabled: true,
  tax_percentage: 18,
  tax_label: 'Tax',
  prices_include_tax: false,
  show_tax_separately: true,
  currency_symbol: '₼',
  currency_code: 'AZN',
  currency_position: 'after',
  currency_decimal_places: 2,
  minimum_order_amount: 0,
  allow_item_notes: true,
  allow_order_notes: true,
  cafe_logo_url: null,
  hero_image_url: null,
  brand_primary_color: '#367B8B',
  brand_secondary_color: '#1E40AF',
  welcome_heading: null,
  welcome_message: null,
  qr_ordering_enabled: true,
  tips_enabled: false,
  waste_tracking_enabled: false,
  delivery_enabled: false,
  delivery_fee_default: 0,
  minimum_delivery_amount: 0,
  delivery_zone_info: null,
  restaurant_address: null,
  contact_phone: null,
  contact_website: null,
  social_instagram: null,
  social_whatsapp: null,
  social_tiktok: null,
  social_telegram: null,
  social_line: null,
  location_maps_url: null,
  default_language: 'en',
  feature_flags: {},
  refund_type_to_confirm_threshold: 100,
  idle_soft_lock_minutes: 60,
  created_at: '',
  updated_at: '',
  ...overrides,
});

// --- Hook tests ---

describe('useCafeSettings', () => {
  it('calls db.settings.get', () => {
    renderHookWithProviders(() => useCafeSettings());
    expect(db.settings.get).toHaveBeenCalled();
  });

  it('returns DEFAULT_SETTINGS when db.settings.get fails', async () => {
    (db.settings.get as any).mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHookWithProviders(() => useCafeSettings());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Should not throw — returns default settings
    expect(result.current.data?.restaurant_name).toBe('Restaurant');
    expect(result.current.data?.currency_symbol).toBe('$');
  });

  it('returns fetched settings on success', async () => {
    const settings = makeSettings({ restaurant_name: 'My Cafe' });
    (db.settings.get as any).mockResolvedValueOnce(settings);

    const { result } = renderHookWithProviders(() => useCafeSettings());

    // placeholderData provides DEFAULT_SETTINGS immediately, wait for actual fetch
    await waitFor(() => expect(result.current.data?.restaurant_name).toBe('My Cafe'));
  });

  it('keys the query by tenantId so cross-tenant cache reuse cannot happen (C6)', async () => {
    // Pre-fix the key was [CAFE_SETTINGS] (no tenant). A browser session
    // that touched two tenants (one Vercel project, multiple QR codes)
    // would reuse the first tenant's settings cache for STALE_TIMES.MEDIUM
    // after switching — wrong currency, wrong restaurant name. The fix
    // threads `db.getTenantId()` into the query key.
    (db.getTenantId as any).mockReturnValue('tenant-A');

    const { queryClient } = renderHookWithProviders(() => useCafeSettings());

    await waitFor(() => {
      const entries = queryClient.getQueryCache().getAll();
      const settingsKeys = entries
        .map((e) => e.queryKey)
        .filter((k) => Array.isArray(k) && (k as unknown[])[0] === QUERY_KEYS.CAFE_SETTINGS);
      expect(settingsKeys).toContainEqual([QUERY_KEYS.CAFE_SETTINGS, 'tenant-A']);
    });
  });

  it('does not fetch before a tenant is bound (avoids caching under a null key, C6)', async () => {
    // Without `enabled: !!tenantId`, a fetch fired before the wrapper
    // is bound would land in the cache under [CAFE_SETTINGS, null] and
    // the first post-bind tenant would re-use that row.
    (db.getTenantId as any).mockReturnValue(null);

    renderHookWithProviders(() => useCafeSettings());

    // Give React Query a tick to fire if it were going to
    await new Promise((r) => setTimeout(r, 10));
    expect(db.settings.get).not.toHaveBeenCalled();
  });
});

// --- Pure function tests ---

describe('calculateTax', () => {
  it('returns 0 when tax is disabled', () => {
    const settings = makeSettings({ tax_enabled: false });
    expect(calculateTax(100, settings)).toBe(0);
  });

  it('calculates exclusive tax correctly', () => {
    const settings = makeSettings({
      tax_enabled: true,
      tax_percentage: 18,
      prices_include_tax: false,
    });
    expect(calculateTax(100, settings)).toBe(18);
  });

  it('extracts inclusive tax correctly', () => {
    const settings = makeSettings({
      tax_enabled: true,
      tax_percentage: 18,
      prices_include_tax: true,
    });
    const tax = calculateTax(118, settings);
    expect(tax).toBeCloseTo(18, 2);
  });

  it('handles 0% tax rate', () => {
    const settings = makeSettings({ tax_enabled: true, tax_percentage: 0 });
    expect(calculateTax(100, settings)).toBe(0);
  });

  it('handles 0% tax rate with prices_include_tax (no divide-by-zero)', () => {
    const settings = makeSettings({
      tax_enabled: true,
      tax_percentage: 0,
      prices_include_tax: true,
    });
    expect(calculateTax(100, settings)).toBe(0);
  });

  it('handles 100% tax rate (exclusive)', () => {
    const settings = makeSettings({ tax_enabled: true, tax_percentage: 100 });
    expect(calculateTax(100, settings)).toBe(100);
  });

  it('handles 100% tax rate (inclusive)', () => {
    const settings = makeSettings({
      tax_enabled: true,
      tax_percentage: 100,
      prices_include_tax: true,
    });
    expect(calculateTax(200, settings)).toBeCloseTo(100, 2);
  });

  it('tax_disabled takes priority over prices_include_tax', () => {
    const settings = makeSettings({ tax_enabled: false, prices_include_tax: true });
    expect(calculateTax(118, settings)).toBe(0);
  });

  it('handles negative subtotal (refund)', () => {
    const settings = makeSettings({ tax_enabled: true, tax_percentage: 18 });
    expect(calculateTax(-100, settings)).toBe(-18);
  });
});

describe('calculateTotal', () => {
  it('returns subtotal when tax is disabled', () => {
    const settings = makeSettings({ tax_enabled: false });
    expect(calculateTotal(100, settings)).toBe(100);
  });

  it('returns subtotal when prices include tax', () => {
    const settings = makeSettings({ tax_enabled: true, prices_include_tax: true });
    expect(calculateTotal(118, settings)).toBe(118);
  });

  it('adds tax for exclusive pricing', () => {
    const settings = makeSettings({
      tax_enabled: true,
      tax_percentage: 18,
      prices_include_tax: false,
    });
    expect(calculateTotal(100, settings)).toBe(118);
  });

  it('returns subtotal for inconsistent state (disabled + include_tax)', () => {
    const settings = makeSettings({ tax_enabled: false, prices_include_tax: true });
    expect(calculateTotal(100, settings)).toBe(100);
  });

  it('handles zero subtotal', () => {
    const settings = makeSettings({ tax_enabled: true, tax_percentage: 18 });
    expect(calculateTotal(0, settings)).toBe(0);
  });
});

describe('getDisplaySubtotal', () => {
  it('strips tax from inclusive price', () => {
    const settings = makeSettings({ prices_include_tax: true, tax_percentage: 18 });
    expect(getDisplaySubtotal(118, settings)).toBeCloseTo(100, 2);
  });

  it('returns subtotal as-is for exclusive pricing', () => {
    const settings = makeSettings({ prices_include_tax: false });
    expect(getDisplaySubtotal(100, settings)).toBe(100);
  });

  it('handles 0% tax with prices_include_tax (no divide-by-zero)', () => {
    const settings = makeSettings({ prices_include_tax: true, tax_percentage: 0 });
    expect(getDisplaySubtotal(100, settings)).toBe(100);
  });

  it('handles 100% tax with inclusive pricing', () => {
    const settings = makeSettings({ prices_include_tax: true, tax_percentage: 100 });
    expect(getDisplaySubtotal(200, settings)).toBeCloseTo(100, 2);
  });

  it('returns full subtotal when tax is disabled even if prices_include_tax is true', () => {
    const settings = makeSettings({
      tax_enabled: false,
      prices_include_tax: true,
      tax_percentage: 18,
    });
    expect(getDisplaySubtotal(118, settings)).toBe(118);
  });
});

describe('formatPrice', () => {
  it('formats with currency after (default AZN)', () => {
    const settings = makeSettings({
      currency_symbol: '₼',
      currency_position: 'after',
      currency_decimal_places: 2,
    });
    expect(formatPrice(10.5, settings)).toBe('10.50₼');
  });

  it('formats with currency before', () => {
    const settings = makeSettings({
      currency_symbol: '$',
      currency_position: 'before',
      currency_decimal_places: 2,
    });
    expect(formatPrice(10.5, settings)).toBe('$10.50');
  });

  it('respects decimal places setting', () => {
    const settings = makeSettings({
      currency_symbol: '€',
      currency_position: 'before',
      currency_decimal_places: 0,
    });
    expect(formatPrice(10.5, settings)).toBe('€11');
  });

  it('formats negative amount (refund)', () => {
    const settings = makeSettings();
    expect(formatPrice(-5.5, settings)).toBe('-5.50₼');
  });

  it('handles NaN amount', () => {
    const settings = makeSettings();
    expect(formatPrice(NaN, settings)).toBe('NaN₼');
  });

  it('formats zero', () => {
    const settings = makeSettings();
    expect(formatPrice(0, settings)).toBe('0.00₼');
  });
});
