import { describe, expect, it } from 'vitest';
import { createSettingsWrapper } from '../wrapper/settings';
import { createMockContext } from './helpers/mock-supabase';

const validSettings = {
  id: '00000000-0000-0000-0000-000000000001',
  restaurant_name: 'Test Cafe',
  currency_symbol: '¥',
  currency_code: 'JPY',
  tax_enabled: true,
  tax_percentage: 10,
  default_language: 'ja',
};

describe('SettingsWrapper', () => {
  it('get returns cafe settings', async () => {
    const ctx = createMockContext({
      responses: {
        cafe_settings: { data: validSettings, error: null },
      },
    });
    const settings = createSettingsWrapper(ctx);
    const result = await settings.get();
    expect(result).toEqual(validSettings);
  });

  it('update modifies cafe settings', async () => {
    const updatedSettings = { ...validSettings, restaurant_name: 'Updated Cafe' };
    const ctx = createMockContext({
      responses: {
        cafe_settings: { data: updatedSettings, error: null },
      },
    });
    const settings = createSettingsWrapper(ctx);
    const result = await settings.update({ restaurant_name: 'Updated Cafe' } as any);
    expect(result.restaurant_name).toBe('Updated Cafe');
    expect(ctx.getCalls()[1].method).toBe('update');
  });

  it('throws on supabase error for get', async () => {
    const ctx = createMockContext({
      responses: {
        cafe_settings: { data: null, error: { status: 404 } },
      },
    });
    const settings = createSettingsWrapper(ctx);
    await expect(settings.get()).rejects.toThrow();
  });

  it('throws on supabase error for update', async () => {
    const ctx = createMockContext({
      responses: {
        cafe_settings: { data: null, error: { status: 403 } },
      },
    });
    const settings = createSettingsWrapper(ctx);
    await expect(settings.update({ restaurant_name: 'Fail' } as any)).rejects.toThrow();
  });
});
