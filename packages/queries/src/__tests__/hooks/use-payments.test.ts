import { describe, expect, it } from 'vitest';
import {
  useOrderPayments,
  useOrderRemainingBalance,
  usePaymentsByStaff,
} from '../../hooks/use-payments';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useOrderPayments', () => {
  it('calls findByOrderId with orderId', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderPayments('o1'));
    expect(mockDb.payments.findByOrderId).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    const { mockDb, result } = renderHookWithProviders(() => useOrderPayments(''));
    expect(mockDb.payments.findByOrderId).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('usePaymentsByStaff', () => {
  it('calls findByReceivedBy with staffId and limit', () => {
    const { mockDb } = renderHookWithProviders(() => usePaymentsByStaff('s1', 10));
    expect(mockDb.payments.findByReceivedBy).toHaveBeenCalledWith('s1', 10);
  });

  it('is disabled when staffId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => usePaymentsByStaff('', 10));
    expect(mockDb.payments.findByReceivedBy).not.toHaveBeenCalled();
  });
});

describe('useOrderRemainingBalance', () => {
  it('calls rpc.getRemainingBalance with orderId', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderRemainingBalance('o1'));
    expect(mockDb.rpc.getRemainingBalance).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useOrderRemainingBalance(''));
    expect(mockDb.rpc.getRemainingBalance).not.toHaveBeenCalled();
  });
});
