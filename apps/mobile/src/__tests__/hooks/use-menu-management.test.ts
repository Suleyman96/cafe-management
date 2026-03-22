import { describe, expect, it, vi } from 'vitest';
import {
  useCreateCategory,
  useCreateMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useToggleMenuItemAvailability,
  useUpdateCategory,
  useUpdateMenuItem,
} from '@/hooks/use-menu-management';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useCreateMenuItem', () => {
  it('invalidates menu-items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateMenuItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'Espresso', price: 3 });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['menu_items']);
  });
});

describe('useUpdateMenuItem', () => {
  it('invalidates menu-items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateMenuItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'm1', data: { name: 'Updated' } });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['menu_items']);
  });
});

describe('useDeleteMenuItem', () => {
  it('invalidates menu-items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteMenuItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('m1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['menu_items']);
  });
});

describe('useToggleMenuItemAvailability', () => {
  it('invalidates menu-items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useToggleMenuItemAvailability());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('m1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['menu_items']);
  });
});

describe('useCreateCategory', () => {
  it('invalidates categories on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateCategory());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'Beverages' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['categories']);
  });
});

describe('useUpdateCategory', () => {
  it('invalidates categories on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateCategory());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'c1', data: { name: 'Updated' } });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['categories']);
  });
});

describe('useDeleteCategory', () => {
  it('invalidates categories and menu-items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteCategory());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('c1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['categories']);
    expect(keys).toContainEqual(['menu_items']);
  });
});
