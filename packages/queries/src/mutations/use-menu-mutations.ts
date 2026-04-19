import { QUERY_KEYS } from '@gustri/core';
import type {
  CategoriesInsert,
  CategoriesUpdate,
  MenuItemsInsert,
  MenuItemsUpdate,
} from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateMenuAndCategories } from '../invalidation';
import { useDb } from '../provider';

// ─── Menu Items ─────────────────────────────────────────────────────────────

export function useCreateMenuItem() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuItemsInsert) => db.menuItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

export function useUpdateMenuItem() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MenuItemsUpdate> }) =>
      db.menuItems.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

export function useDeleteMenuItem() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.menuItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

export function useToggleMenuItemAvailability() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, currentAvailable }: { id: string; currentAvailable: boolean }) =>
      db.menuItems.toggleAvailability(id, currentAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
  });
}

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCreateCategory() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoriesInsert) => db.categories.create(data),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient);
    },
  });
}

export function useUpdateCategory() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CategoriesUpdate> }) =>
      db.categories.update(id, updates),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient);
    },
  });
}

export function useDeleteCategory() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.categories.delete(id),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient);
    },
  });
}
