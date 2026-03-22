import { QUERY_KEYS } from '@cafe-idare/core';
import type {
  CategoriesInsert,
  CategoriesUpdate,
  MenuItemsInsert,
  MenuItemsUpdate,
} from '@cafe-idare/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useCreateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MenuItemsInsert) => db.menuItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
    onError: (error: Error) => {
      console.error('Failed to create menu item:', error.message);
    },
  });
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MenuItemsUpdate }) =>
      db.menuItems.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
    onError: (error: Error) => {
      console.error('Failed to update menu item:', error.message);
    },
  });
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.menuItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete menu item:', error.message);
    },
  });
}

export function useToggleMenuItemAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.menuItems.toggleAvailability(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
    onError: (error: Error) => {
      console.error('Failed to toggle menu item availability:', error.message);
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CategoriesInsert) => db.categories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
    },
    onError: (error: Error) => {
      console.error('Failed to create category:', error.message);
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoriesUpdate }) =>
      db.categories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
    },
    onError: (error: Error) => {
      console.error('Failed to update category:', error.message);
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MENU_ITEMS] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete category:', error.message);
    },
  });
}
