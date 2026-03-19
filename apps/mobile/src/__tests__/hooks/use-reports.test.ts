import { describe, expect, it } from 'vitest';
import { useSalesSummary } from '@/hooks/use-reports';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useSalesSummary', () => {
  it('calls db.views.getSalesSummary', () => {
    renderHookWithProviders(() => useSalesSummary());
    expect(db.views.getSalesSummary).toHaveBeenCalled();
  });

  it('passes date range parameters', () => {
    renderHookWithProviders(() => useSalesSummary('2026-03-01', '2026-03-31'));
    expect(db.views.getSalesSummary).toHaveBeenCalledWith('2026-03-01', '2026-03-31');
  });
});
