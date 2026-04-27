import { describe, expect, it } from 'vitest';
import { useActiveWaiters, useStaff, useStaffByEmail, useStaffMember } from '../../hooks/use-staff';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useStaff', () => {
  it('calls findAll without args when role omitted', () => {
    const { mockDb } = renderHookWithProviders(() => useStaff());
    expect(mockDb.staff.findAll).toHaveBeenCalledWith(undefined);
  });

  it('forwards role filter', () => {
    const { mockDb } = renderHookWithProviders(() => useStaff('waiter'));
    expect(mockDb.staff.findAll).toHaveBeenCalledWith({ role: 'waiter' });
  });
});

describe('useStaffMember', () => {
  it('calls findById with id', () => {
    const { mockDb } = renderHookWithProviders(() => useStaffMember('s1'));
    expect(mockDb.staff.findById).toHaveBeenCalledWith('s1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb, result } = renderHookWithProviders(() => useStaffMember(''));
    expect(mockDb.staff.findById).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useActiveWaiters', () => {
  it('calls db.staff.getActiveWaiters', () => {
    const { mockDb } = renderHookWithProviders(() => useActiveWaiters());
    expect(mockDb.staff.getActiveWaiters).toHaveBeenCalled();
  });
});

describe('useStaffByEmail', () => {
  it('calls findByEmail when email provided', () => {
    const { mockDb } = renderHookWithProviders(() => useStaffByEmail('a@b.com'));
    expect(mockDb.staff.findByEmail).toHaveBeenCalledWith('a@b.com');
  });

  it('is disabled when email is empty', () => {
    const { mockDb, result } = renderHookWithProviders(() => useStaffByEmail(''));
    expect(mockDb.staff.findByEmail).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
