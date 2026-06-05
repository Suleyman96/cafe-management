/**
 * Type-Safe Orders Hooks
 * Re-exports from @gustri/queries, with local overrides for optimistic updates
 * and app-specific mutations (apiRoutes).
 */

import { ORDER_VERSION_CONFLICT } from '@gustri/api-client';
import { ConflictError, isAppError, ORDER_STATUS } from '@gustri/core';
import type { Database } from '@gustri/database/types';
import { localizeErrorMessage, useTranslation } from '@gustri/i18n';
import {
  getOrCreateClientRequestId,
  QUERY_KEYS,
  tenantKey,
  useFeatureFlag,
  useOrders as useOrdersShared,
  useTenantId,
} from '@gustri/queries';
import * as Sentry from '@sentry/nextjs';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiRoutes } from '@/lib/api-routes';
import { withOptimisticTtl } from '@/lib/optimistic-ttl';
import { invalidateOrders, invalidateOrdersAndTables } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';
import type { OrderWithDetails } from '@/types';

const ORDERS_OPTIMISTIC_CONCURRENCY_FLAG = 'orders_optimistic_concurrency';

/**
 * Read the cached `version` for an order across the keys mutating hooks
 * may have populated (single ORDER, ORDERS list, ACTIVE_ORDERS list).
 * Returns `undefined` when no copy is in cache — callers omit
 * `expectedVersion` in that case so the wrapper falls back to the
 * version-naive UPDATE path (better than silently no-op'ing on a stale
 * read of `0`).
 */
function readCachedOrderVersion(
  qc: QueryClient,
  tenantId: string | null,
  orderId: string,
): number | undefined {
  const direct = qc.getQueryData<OrderWithDetails>(tenantKey(tenantId, QUERY_KEYS.ORDER, orderId));
  if (typeof direct?.version === 'number') return direct.version;
  const lists = [QUERY_KEYS.ORDERS, QUERY_KEYS.ACTIVE_ORDERS] as const;
  for (const key of lists) {
    const list = qc.getQueryData<OrderWithDetails[]>(tenantKey(tenantId, key));
    const found = list?.find((o) => o.id === orderId);
    if (typeof found?.version === 'number') return found.version;
  }
  return undefined;
}

/**
 * Type guard: does this error represent a stale-version conflict from the
 * orders wrapper (Plan 8)? Modals catch these to render a Refresh/Override
 * banner rather than a generic toast.
 */
export function isOrderVersionConflict(error: unknown): error is ConflictError {
  return error instanceof ConflictError && error.message === ORDER_VERSION_CONFLICT;
}

type OrderStatus = Database['public']['Tables']['orders']['Row']['status'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];

// Re-export shared read hooks
// Re-export shared simple mutations.
// Note: useCancelOrder is overridden locally below to support optimistic
// concurrency (Plan 8); do NOT re-export the shared one here.
export {
  useActiveOrders,
  useAddOrderItems,
  useCleanupEmptyOrders,
  useDeleteOrderItem,
  useOrder,
  useOrders,
  useUpdateOrderNotes,
} from '@gustri/queries';

// Local: assignment is admin-only and goes through `/api/v1/orders/[id]/assign`,
// not the wrapper. Pre-fix, assigning was a direct UPDATE that any active
// staff could trigger; we now route through `verifyAdmin`. Mobile doesn't
// expose a reassign UI today, so the hook is staff-web-local rather than in
// `@gustri/queries`.
export function useAssignWaiter() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ orderId, waiterId }: { orderId: string; waiterId: string | null }) =>
      apiRoutes.orders.assignWaiter(orderId, waiterId),
    onSuccess: () => {
      invalidateOrders(queryClient, tenantId);
    },
  });
}

// Local override: different param shape ({ itemId } vs shared { id })
export function useCancelOrderItem() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: ({ itemId, cancelQty }: { itemId: string; cancelQty?: number }) =>
      db.orderItems.cancel(itemId, cancelQty),
    onSuccess: () => {
      // Item-level cancel — order may flip to empty/cancelled but TABLES/DELIVERY/TAKEOUT
      // shape doesn't shift on item changes. Refetch only ORDERS.
      invalidateOrders(queryClient, tenantId);
    },
  });
}

// Local override: optimistic updates for order status changes.
//
// Plan 8 — when feature flag `orders_optimistic_concurrency` is on, the
// hook reads the cached `version` and forwards it as `expectedVersion`.
// A concurrent web/mobile edit on a stale view trips the wrapper's
// 0-row UPDATE detection and surfaces ConflictError(version_conflict),
// which the global mutation cache localizes via `localizeErrorMessage`
// ("Another device just changed this order. Refresh and try again.").
// `onSettled` then refetches truth, so the kitchen view converges
// without operator intervention. The plan calls this the "soft toast"
// path — no explicit Refresh/Override modal for high-concurrency status
// moves.
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const versionCheckEnabled = useFeatureFlag(ORDERS_OPTIMISTIC_CONCURRENCY_FLAG);

  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: keyof typeof ORDER_STATUS }) => {
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      // Mint a fresh idempotency key per attempt. The wrapper is idempotent
      // via a conditional UPDATE, so this key is currently unused server-side
      // but reserved for a future status-update audit log.
      const clientRequestId = getOrCreateClientRequestId();
      const expectedVersion = versionCheckEnabled
        ? readCachedOrderVersion(queryClient, tenantId, orderId)
        : undefined;
      return db.orders.updateStatus(orderId, statusValue, { clientRequestId, expectedVersion });
    },
    onMutate: async ({ orderId, status }) => {
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      await queryClient.cancelQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      await queryClient.cancelQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS) });

      // Capture pre-mutation order so we can pass {oldStatus, oldType} to
      // invalidateOrdersAndTables in onSettled. Without this the helper
      // can't tell whether the transition crossed a terminal state and
      // would invalidate TABLES on every kitchen toggle.
      const previousOrder = queryClient.getQueryData<OrderWithDetails>(
        tenantKey(tenantId, QUERY_KEYS.ORDER, orderId),
      );

      // Optimistic patch on the affected row only. We deliberately do NOT
      // snapshot the full list for rollback — restoring a pre-mutation list
      // on error would clobber any realtime updates (delivery_fee,
      // customer_notes, item-level changes) that landed between onMutate and
      // onError. On error we leave the optimistic patch in place; onSettled's
      // invalidate refetches truth from the server. (Audit plan Option A.)
      const updateList = (old: OrderWithDetails[] | undefined) =>
        old?.map((o) => (o.id === orderId ? { ...o, status: statusValue } : o));

      queryClient.setQueryData(tenantKey(tenantId, QUERY_KEYS.ORDERS), updateList);
      queryClient.setQueryData(tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS), updateList);

      // Zombie-patch killer: if onSettled never fires (silent network drop,
      // tab backgrounded mid-flight) the optimistic patch above is reverted
      // by a forced invalidate after the TTL.
      const cancelTtl = withOptimisticTtl(queryClient, [
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS),
      ]);

      return { previousOrder, cancelTtl };
    },
    onSettled: (_data, _err, { orderId, status }, context) => {
      context?.cancelTtl?.();
      const statusValue = ORDER_STATUS[status] as OrderStatus;
      invalidateOrdersAndTables(queryClient, tenantId, {
        orderId,
        oldStatus: context?.previousOrder?.status,
        newStatus: statusValue,
        oldType: context?.previousOrder?.order_type,
      });
    },
  });
}

// Local: closing an order goes through the dedicated wrapper.close() so a
// `force_close_reason` can ride on the same UPDATE that flips status. The
// server-side guard trigger (migration 20260506000003) rejects the close
// with ConflictError('order_close_requires_payment_or_reason') when the
// order still owes money and no reason was provided — the UI catches that
// and opens the close-unpaid modal.
//
// Plan 8 — close is a destructive action; when feature flag
// `orders_optimistic_concurrency` is on, the hook gates the UPDATE on
// `expectedVersion` from the cached order. On conflict the modal renders
// an explicit Refresh / Override banner (`isOrderVersionConflict`); the
// `override` flag re-issues the close without `expectedVersion` so the
// operator can intentionally proceed past the staleness warning.
const CLOSE_UNPAID_CONFLICT = 'order_close_requires_payment_or_reason';

export function useCloseOrder() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const { t } = useTranslation('staff');
  const versionCheckEnabled = useFeatureFlag(ORDERS_OPTIMISTIC_CONCURRENCY_FLAG);

  return useMutation({
    mutationFn: ({
      orderId,
      forceCloseReason,
      override,
    }: {
      orderId: string;
      forceCloseReason?: string;
      /**
       * When true, skip the `expectedVersion` check — used for the
       * "Override" branch of the conflict banner. Server-side guards
       * (close-unpaid, state machine) still apply.
       */
      override?: boolean;
    }) => {
      const expectedVersion =
        versionCheckEnabled && !override
          ? readCachedOrderVersion(queryClient, tenantId, orderId)
          : undefined;
      const opts: { forceCloseReason?: string; expectedVersion?: number } = {};
      if (forceCloseReason !== undefined) opts.forceCloseReason = forceCloseReason;
      if (expectedVersion !== undefined) opts.expectedVersion = expectedVersion;
      return db.orders.close(orderId, Object.keys(opts).length === 0 ? undefined : opts);
    },
    onSettled: (_data, _err, { orderId }) => {
      // Closing crosses a terminal-state boundary, so refetch tables too —
      // the dine-in table flips to free when its last active order closes.
      // We also invalidate on error so a version conflict path immediately
      // hydrates the modal with the freshest version.
      const previousOrder = queryClient.getQueryData<OrderWithDetails>(
        tenantKey(tenantId, QUERY_KEYS.ORDER, orderId),
      );
      invalidateOrdersAndTables(queryClient, tenantId, {
        orderId,
        oldStatus: previousOrder?.status,
        newStatus: 'closed',
        oldType: previousOrder?.order_type,
      });
    },
    // Owning onError takes us off the global mutation cache toast path, so
    // we fully replicate it here: localized message for known sentinels,
    // generic fallback otherwise. The version-conflict branch suppresses
    // the toast — the calling modal renders the Refresh/Override banner
    // off the mutation's `error` state instead.
    onError: (error) => {
      if (error instanceof ConflictError && error.message === CLOSE_UNPAID_CONFLICT) {
        toast.error(t('orders.closeUnpaid.serverConflict'));
        return;
      }
      if (isOrderVersionConflict(error)) {
        // Modal-driven UI; do not double-up with a toast. The mutation's
        // `error` carries the sentinel for the banner to detect.
        return;
      }
      Sentry.captureException(error);
      toast.error(isAppError(error) ? error.message : t('orders.failedUpdateStatus'));
    },
  });
}

/**
 * Local override of the shared `useCancelOrder` so cancel — like close —
 * can opt into the `expectedVersion` concurrency check (Plan 8). Same
 * call shape as the shared hook plus an `override` flag for the conflict
 * banner's "Override" path.
 */
export function useCancelOrder() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  const versionCheckEnabled = useFeatureFlag(ORDERS_OPTIMISTIC_CONCURRENCY_FLAG);

  return useMutation({
    mutationFn: ({
      orderId,
      reason,
      tableId,
      override,
    }: {
      orderId: string;
      reason: string;
      tableId?: string | null;
      override?: boolean;
    }) => {
      const expectedVersion =
        versionCheckEnabled && !override
          ? readCachedOrderVersion(queryClient, tenantId, orderId)
          : undefined;
      const opts = expectedVersion !== undefined ? { expectedVersion } : undefined;
      return db.orders.cancelOrder(orderId, reason, tableId ?? null, opts);
    },
    onSettled: (_data, _err, { orderId }) => {
      const previousOrder = queryClient.getQueryData<OrderWithDetails>(
        tenantKey(tenantId, QUERY_KEYS.ORDER, orderId),
      );
      invalidateOrdersAndTables(queryClient, tenantId, {
        orderId,
        oldStatus: previousOrder?.status,
        newStatus: 'cancelled',
        oldType: previousOrder?.order_type,
      });
    },
    onError: (error) => {
      if (isOrderVersionConflict(error)) {
        // Caller renders the Refresh/Override banner from mutation.error.
        return;
      }
      // Defining onError opts this mutation out of the global mutationCache
      // toast path (see app providers), so replicate localization locally.
      Sentry.captureException(error);
      const fallback = 'Failed to cancel';
      toast.error(isAppError(error) ? localizeErrorMessage(error.message, fallback) : fallback);
    },
  });
}

// Local override: optimistic updates for order item status changes
export function useUpdateOrderItemStatus() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  type OrderItemStatus = Database['public']['Tables']['order_items']['Row']['status'];

  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: OrderItemStatus }) => {
      return db.orderItems.updateStatus(itemId, status);
    },
    onMutate: async ({ itemId, status }) => {
      await queryClient.cancelQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      await queryClient.cancelQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS) });

      // Optimistic patch only — see useUpdateOrderStatus for the rationale.
      // No full-list snapshot: a rollback would lose any realtime changes
      // that arrive mid-flight. onSettled's invalidate converges on truth.
      const updateList = (old: OrderWithDetails[] | undefined) =>
        old?.map((order) => ({
          ...order,
          order_items: order.order_items?.map((item) =>
            item.id === itemId ? { ...item, status } : item,
          ),
        }));

      queryClient.setQueryData(tenantKey(tenantId, QUERY_KEYS.ORDERS), updateList);
      queryClient.setQueryData(tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS), updateList);

      // Zombie-patch killer — see useUpdateOrderStatus for rationale.
      const cancelTtl = withOptimisticTtl(queryClient, [
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS),
      ]);

      return { cancelTtl };
    },
    onSettled: (_data, _err, _vars, context) => {
      context?.cancelTtl?.();
      // Item status changes don't move the order between terminal states —
      // tables, delivery and takeout shapes are unaffected. Refetch only ORDERS.
      invalidateOrders(queryClient, tenantId);
    },
  });
}

// Local: uses apiRoutes for server-side plan limit enforcement
export function useCreateOrder() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    // `retry: 0` — order create is multi-table-transaction-heavy on the
    // server (plan check + insert + trigger fan-out). User-driven retries
    // reuse the same client_request_id (stamped below) so the server
    // dedupes via the (tenant_id, client_request_id) unique index.
    retry: 0,
    onMutate: (orderData: OrderInsert) => {
      orderData.client_request_id = getOrCreateClientRequestId(orderData.client_request_id);
    },
    mutationFn: async (orderData: OrderInsert) => {
      // Plan limit is enforced server-side in the API route.
      // `client_request_id` is required by the route schema (Blocker 1).
      // `onMutate` above stamped the field; mint here too as a safety net
      // for unit tests that bypass `onMutate`. `getOrCreateClientRequestId`
      // is idempotent on a populated value so this is a no-op in the
      // hot path.
      const clientRequestId = getOrCreateClientRequestId(orderData.client_request_id);
      const { order } = await apiRoutes.orders.create({
        ...orderData,
        client_request_id: clientRequestId,
      });
      return order;
    },
    onSuccess: (createdOrder) => {
      invalidateOrdersAndTables(queryClient, tenantId, {
        isCreation: true,
        newType: createdOrder.order_type,
        newStatus: createdOrder.status,
      });
      // Plan-cap widget — kept unconditional; gating on near-cap requires
      // plan-aware logic that doesn't belong in a write hook.
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.MONTHLY_ORDER_COUNT),
      });
    },
  });
}

// Composite hook: derives pending approval count from orders. The limit caps
// the worst case — pending-approval orders should clear within seconds, so
// 100 is plenty even for a busy floor and stays bounded if the queue stalls.
export function usePendingApprovalCount() {
  const { data: orders } = useOrdersShared({
    status: 'pending_approval' as OrderStatus,
    limit: 100,
  });
  return (orders || []).length;
}

// Note: Payment-related hooks are in use-payments-safe.ts
// Note: Transfer-related hooks are in use-table-transfers-safe.ts
