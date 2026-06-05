import type { Staff } from '@gustri/database/types';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCanPerform } from '../../hooks/use-can-perform';
import { useAuthStore } from '../../store/auth-store';

function setRole(role: Staff['role'] | null) {
  if (role === null) {
    useAuthStore.setState({ staff: null, isLoading: false });
    return;
  }
  useAuthStore.setState({
    staff: { id: 's1', tenant_id: 't1', role, is_active: true } as unknown as Staff,
    isLoading: false,
  });
}

describe('useCanPerform', () => {
  beforeEach(() => {
    useAuthStore.setState({ staff: null, isLoading: true });
  });

  it('returns false when no staff is signed in', () => {
    setRole(null);
    const { result } = renderHook(() => useCanPerform('edit_menu'));
    expect(result.current).toBe(false);
  });

  it('returns true for a role allowed by the action policy', () => {
    setRole('admin');
    const { result } = renderHook(() => useCanPerform('edit_menu'));
    expect(result.current).toBe(true);
  });

  it('returns false for a role not allowed by the action policy', () => {
    setRole('waiter');
    const { result } = renderHook(() => useCanPerform('edit_menu'));
    expect(result.current).toBe(false);
  });

  it('honors owner-only actions', () => {
    setRole('admin');
    const adminResult = renderHook(() => useCanPerform('grant_owner_role'));
    expect(adminResult.result.current).toBe(false);

    setRole('owner');
    const ownerResult = renderHook(() => useCanPerform('grant_owner_role'));
    expect(ownerResult.result.current).toBe(true);
  });

  it('honors kitchen-inclusive actions', () => {
    setRole('kitchen');
    const kitchenResult = renderHook(() => useCanPerform('mark_item_ready'));
    expect(kitchenResult.result.current).toBe(true);

    setRole('waiter');
    const waiterResult = renderHook(() => useCanPerform('mark_item_ready'));
    expect(waiterResult.result.current).toBe(false);
  });
});
