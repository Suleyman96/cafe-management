'use client';

import { isAppError } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { LoadingSpinner } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { Check, ConciergeBell, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { TableNotActiveScreen } from '@/components/table/table-not-active-screen';
import { useTable } from '@/hooks/use-table';
import { useCreateWaiterCall, useOpenWaiterCallsForTable } from '@/hooks/use-waiter-call';
import { bindCustomerTenantContext, db } from '@/lib/supabase';
import { useCartStore } from '@/store/cart-store';

export default function TableLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tableId: string };
}) {
  const { t } = useTranslation('customer');
  const { data: table, error: tableError } = useTable(params.tableId);
  const actualTableId = table?.id || '';
  const createWaiterCall = useCreateWaiterCall();
  // H6 — open-call gate. When a `pending` waiter_calls row already
  // exists for this table, swap the FAB into a "Waiter notified" state
  // so a spam-retap during a noisy rush doesn't fan out into duplicate
  // staff queue rows. Unlocks the moment staff acknowledges (realtime).
  const { hasOpenCall } = useOpenWaiterCallsForTable(actualTableId || null);
  // H5 — staff renamed / deleted this table mid-session. Without this
  // gate, every nested screen renders an infinite `LoadingSpinner`
  // because the `table?.tenant_id ? children : <LoadingSpinner />`
  // branch below stays on the spinner forever. Catch the NOT_FOUND at
  // the layout so the recovery screen renders before any nested useTable
  // re-runs hit the same error.
  const tableNotFound = isAppError(tableError) && tableError.code === 'NOT_FOUND';

  // Bind wrapper-side tenant filter as soon as the table resolves. Without
  // this, navigating directly to /table/T01/menu (no `?token=` query param)
  // leaves `db.tenantId` null, and queries fall back to RLS-only — and the
  // anon RLS on menu/category/tables tables is `USING (true)`. The wrapper
  // appending `.eq('tenant_id', X)` is the actual current isolation gate
  // for these reads; binding it here closes the gap on direct navigation.
  //
  // Bind is done synchronously during render (not in useEffect) so that
  // children below see the bound wrapper on their first render — useEffect
  // runs after children mount and fire their queries, which would race
  // with anon DBs that contain rows from multiple tenants (the CI Supabase
  // is left in that state by `Run RLS policy tests`, which seeds tenant-2
  // probe rows that the customer-web menu would otherwise pick up). Pairs
  // with the `tenant ? children : <LoadingSpinner />` gate below so the
  // wrapper is bound before any wrapper read fires from inside `children`.
  if (table?.tenant_id && db.getTenantId() !== table.tenant_id) {
    bindCustomerTenantContext(table.tenant_id, 'table-layout');
  }
  useEffect(() => {
    return () => {
      // Clear on unmount so a different tab/session can't inherit a stale
      // tenant id. The wrapper is a singleton; explicit cleanup matters.
      bindCustomerTenantContext(null, 'table-layout-unmount');
    };
  }, []);

  // M4 — bind the cart partition once the table row resolves. Pre-M4
  // the cart was a single global; a customer who scanned tenant A,
  // added items, and navigated to `/delivery?token=B` would submit
  // tenant A's `menu_item_id`s against tenant B's qr_token and see
  // a generic RLS error. With the partition bound, the customer's
  // cart is *the* dine-in cart for this tenant+table, distinct from
  // any delivery cart they may have under the same tenant. Cleanup
  // on unmount: clear the partition (NOT the items) so the in-memory
  // copy stays consistent if the customer comes back via fast-nav.
  useEffect(() => {
    if (table?.tenant_id && actualTableId) {
      useCartStore.getState().setPartition({
        flow: 'dine_in',
        tenantId: table.tenant_id,
        tableId: actualTableId,
      });
    }
  }, [table?.tenant_id, actualTableId]);

  const handleCallStaff = async () => {
    if (!actualTableId || createWaiterCall.isPending) return;
    // H6 — short-circuit on the server-driven open-call gate. A
    // double-tap during noise would otherwise mint a fresh id (the
    // success-then-reset cycle in the idempotency store) and insert
    // a second `waiter_calls` row. The toast keeps the customer in
    // the loop instead of letting the button feel dead.
    if (hasOpenCall) {
      toast.info(t('callStaff.alreadyNotified'));
      return;
    }

    try {
      await createWaiterCall.mutateAsync({
        tableId: actualTableId,
        callType: 'assistance',
        reason: t('callStaff.reason.assistance'),
        priority: 'normal',
      });
      toast.success(t('callStaff.toastSuccess'));
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('callStaff.toastError'));
    }
  };

  // H5 — render the recovery screen alone (no FAB, no children). The
  // call-staff FAB needs `actualTableId` to fire and would 404 the same
  // way; the recovery screen carries its own refresh CTA.
  if (tableNotFound) {
    return <TableNotActiveScreen />;
  }

  return (
    <>
      {table?.tenant_id ? children : <LoadingSpinner />}

      {/* A1 / A2 — meet the 44×44 touch target and flip side in RTL.
          On `sm+` the label stays inline; on narrow phones it collapses
          to a circular icon FAB so the hit area is comfortably above
          the WCAG floor without consuming horizontal space.
          H6 — when an open `pending` waiter_calls row exists, swap the
          icon + label into a "Waiter notified" state and disable the
          button. Realtime unlocks it the moment staff acknowledges. */}
      <button
        onClick={handleCallStaff}
        disabled={!actualTableId || createWaiterCall.isPending || hasOpenCall}
        className="fixed bottom-5 left-3 rtl:left-auto rtl:right-3 z-40 flex h-14 w-14 sm:h-auto sm:w-auto items-center justify-center sm:gap-2 rounded-full bg-white/90 dark:bg-neutral-800/90 sm:px-4 sm:py-3 text-xs font-medium text-neutral-700 dark:text-neutral-200 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-all hover:shadow-xl active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed"
        title={hasOpenCall ? t('callStaff.notifiedTitle') : t('callStaff.title')}
        aria-label={hasOpenCall ? t('callStaff.notifiedTitle') : t('callStaff.title')}
        data-testid="call-staff-fab"
      >
        {createWaiterCall.isPending ? (
          <Loader2 className="h-5 w-5 sm:h-4 sm:w-4 animate-spin" />
        ) : hasOpenCall ? (
          <Check className="h-5 w-5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <ConciergeBell className="h-5 w-5 sm:h-4 sm:w-4" />
        )}
        <span className="hidden sm:inline">
          {hasOpenCall ? t('callStaff.notifiedTitle') : t('callStaff.title')}
        </span>
      </button>
    </>
  );
}
