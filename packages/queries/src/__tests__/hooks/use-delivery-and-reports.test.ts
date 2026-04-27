import { describe, expect, it } from 'vitest';
import {
  useDeliveryCustomers,
  useDeliveryCustomersPaginated,
  useSearchDeliveryCustomers,
} from '../../hooks/use-delivery';
import {
  useExpenseSummary,
  useRevenueSummary,
  useStaffPerformance,
  useTopSoldItems,
  useWasteSummary,
} from '../../hooks/use-reports';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('delivery customer hooks', () => {
  it('useDeliveryCustomers calls findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useDeliveryCustomers());
    expect(mockDb.deliveryCustomers.findAll).toHaveBeenCalled();
  });

  it('useDeliveryCustomersPaginated forwards page params', () => {
    const { mockDb } = renderHookWithProviders(() => useDeliveryCustomersPaginated(1, 50, 'a'));
    expect(mockDb.deliveryCustomers.findAllPaginated).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: 'a',
    });
  });

  it('useSearchDeliveryCustomers disabled when query empty', () => {
    const { mockDb } = renderHookWithProviders(() => useSearchDeliveryCustomers(''));
    expect(mockDb.deliveryCustomers.search).not.toHaveBeenCalled();
  });

  it('useSearchDeliveryCustomers calls search', () => {
    const { mockDb } = renderHookWithProviders(() => useSearchDeliveryCustomers('john'));
    expect(mockDb.deliveryCustomers.search).toHaveBeenCalledWith('john');
  });
});

describe('report hooks', () => {
  it('useRevenueSummary disabled when tenantId missing', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useRevenueSummary(undefined, '2026-04-01', '2026-04-30'),
    );
    expect(mockDb.reports.getRevenueSummary).not.toHaveBeenCalled();
  });

  it('useRevenueSummary forwards args when tenantId present', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useRevenueSummary('t1', '2026-04-01', '2026-04-30'),
    );
    expect(mockDb.reports.getRevenueSummary).toHaveBeenCalledWith('t1', '2026-04-01', '2026-04-30');
  });

  it('useTopSoldItems forwards limit', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useTopSoldItems('t1', '2026-04-01', '2026-04-30', 5),
    );
    expect(mockDb.reports.getTopSoldItems).toHaveBeenCalledWith(
      't1',
      '2026-04-01',
      '2026-04-30',
      5,
    );
  });

  it('useExpenseSummary disabled when from missing', () => {
    const { mockDb } = renderHookWithProviders(() => useExpenseSummary('t1', '', '2026-04-30'));
    expect(mockDb.reports.getExpenseSummary).not.toHaveBeenCalled();
  });

  it('useWasteSummary forwards args', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useWasteSummary('t1', '2026-04-01', '2026-04-30'),
    );
    expect(mockDb.reports.getWasteSummary).toHaveBeenCalledWith('t1', '2026-04-01', '2026-04-30');
  });

  it('useStaffPerformance forwards args', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useStaffPerformance('t1', '2026-04-01', '2026-04-30'),
    );
    expect(mockDb.reports.getStaffPerformance).toHaveBeenCalledWith(
      't1',
      '2026-04-01',
      '2026-04-30',
    );
  });
});
