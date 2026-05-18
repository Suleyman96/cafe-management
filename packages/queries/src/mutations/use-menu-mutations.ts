import type {
  CategoriesInsert,
  CategoriesUpdate,
  MenuItem,
  MenuItemsInsert,
  MenuItemsUpdate,
} from '@gustri/database';
import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { invalidateMenuAndCategories } from '../invalidation';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

// Optimistic-update plumbing for the three channel toggles (available,
// takeoutable, deliverable). Without this, the switch's visual state
// only flips after the network round-trip + cache refetch — feels
// unresponsive on slow networks and silently regresses if the user
// double-clicks. The pattern:
//
//   onMutate:  cancel in-flight refetches, snapshot every cached menu
//              list, write the flipped value into each list optimistically.
//              Return the snapshot so we can roll back on failure.
//   onError:   restore each cached list to its pre-mutation value.
//   onSettled: invalidate the list — refetch ensures cache eventually
//              matches server even after a long offline → online window
//              where the optimistic write may have drifted from truth.
//
// Operates across ALL cached menu_items queries for the tenant (any
// filter combination — takeoutable=true, deliverable=true, categoryId,
// etc.) because the toggle changes one row that may participate in
// many filtered views.

type ToggleField = 'is_available' | 'is_takeoutable' | 'is_deliverable';

type MenuListSnapshot = Array<[QueryKey, MenuItem[] | undefined]>;

async function applyOptimisticToggle(
  queryClient: QueryClient,
  // Mirrors useTenantId() — null during the brief pre-DbProvider window.
  // tenantKey() handles null via its NO_TENANT_KEY_SEGMENT sentinel, so
  // we just thread the same union through here.
  tenantId: string | null,
  itemId: string,
  field: ToggleField,
  newValue: boolean,
): Promise<MenuListSnapshot> {
  const queryKey = tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS);
  // Cancel any in-flight refetch so it can't overwrite our optimistic
  // update mid-flight (TanStack Query docs explicitly call this out as
  // required for any onMutate → setQueryData pattern).
  await queryClient.cancelQueries({ queryKey });

  const snapshot = queryClient.getQueriesData<MenuItem[]>({ queryKey });

  queryClient.setQueriesData<MenuItem[]>({ queryKey }, (old) => {
    if (!old) return old;
    return old.map((item) =>
      item.id === itemId ? ({ ...item, [field]: newValue } as MenuItem) : item,
    );
  });

  return snapshot;
}

function rollbackOptimisticToggle(queryClient: QueryClient, snapshot: MenuListSnapshot): void {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data);
  }
}

// ─── Menu Items ─────────────────────────────────────────────────────────────

export function useCreateMenuItem(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MenuItemsInsert) => db.menuItems.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
    onError: options?.onError,
  });
}

export function useUpdateMenuItem(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MenuItemsUpdate> }) =>
      db.menuItems.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
    onError: options?.onError,
  });
}

export function useDeleteMenuItem(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.menuItems.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
    onError: options?.onError,
  });
}

export function useToggleMenuItemAvailability(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, currentAvailable }: { id: string; currentAvailable: boolean }) =>
      db.menuItems.toggleAvailability(id, currentAvailable),
    onMutate: ({ id, currentAvailable }) =>
      applyOptimisticToggle(queryClient, tenantId, id, 'is_available', !currentAvailable).then(
        (snapshot) => ({ snapshot }),
      ),
    onError: (err, _vars, context) => {
      if (context?.snapshot) rollbackOptimisticToggle(queryClient, context.snapshot);
      options?.onError?.(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
  });
}

export function useToggleMenuItemTakeoutable(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, currentTakeoutable }: { id: string; currentTakeoutable: boolean }) =>
      db.menuItems.toggleTakeoutable(id, currentTakeoutable),
    onMutate: ({ id, currentTakeoutable }) =>
      applyOptimisticToggle(queryClient, tenantId, id, 'is_takeoutable', !currentTakeoutable).then(
        (snapshot) => ({ snapshot }),
      ),
    onError: (err, _vars, context) => {
      if (context?.snapshot) rollbackOptimisticToggle(queryClient, context.snapshot);
      options?.onError?.(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
  });
}

export function useToggleMenuItemDeliverable(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, currentDeliverable }: { id: string; currentDeliverable: boolean }) =>
      db.menuItems.toggleDeliverable(id, currentDeliverable),
    onMutate: ({ id, currentDeliverable }) =>
      applyOptimisticToggle(queryClient, tenantId, id, 'is_deliverable', !currentDeliverable).then(
        (snapshot) => ({ snapshot }),
      ),
    onError: (err, _vars, context) => {
      if (context?.snapshot) rollbackOptimisticToggle(queryClient, context.snapshot);
      options?.onError?.(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.MENU_ITEMS) });
    },
  });
}

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCreateCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoriesInsert) => db.categories.create(data),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useUpdateCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CategoriesUpdate> }) =>
      db.categories.update(id, updates),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useDeleteCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.categories.delete(id),
    onSuccess: () => {
      invalidateMenuAndCategories(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}
