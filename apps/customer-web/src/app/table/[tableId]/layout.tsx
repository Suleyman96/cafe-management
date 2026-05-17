'use client';

import { useTranslation } from '@gustri/i18n';
import { LoadingSpinner } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { ConciergeBell, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useTable } from '@/hooks/use-table';
import { useCreateWaiterCall } from '@/hooks/use-waiter-call';
import { db } from '@/lib/supabase';

export default function TableLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tableId: string };
}) {
  const { t } = useTranslation('customer');
  const { data: table } = useTable(params.tableId);
  const actualTableId = table?.id || '';
  const createWaiterCall = useCreateWaiterCall();

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
    db.setTenantContext(table.tenant_id);
  }
  useEffect(() => {
    return () => {
      // Clear on unmount so a different tab/session can't inherit a stale
      // tenant id. The wrapper is a singleton; explicit cleanup matters.
      db.setTenantContext(null);
    };
  }, []);

  const handleCallStaff = async () => {
    if (!actualTableId || createWaiterCall.isPending) return;

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

  return (
    <>
      {table?.tenant_id ? children : <LoadingSpinner />}

      <button
        onClick={handleCallStaff}
        disabled={!actualTableId || createWaiterCall.isPending}
        className="fixed bottom-5 left-3 z-40 flex items-center gap-1 rounded-full bg-white/90 dark:bg-neutral-800/90 px-2.5 py-1.5 text-[10px] font-medium text-neutral-700 dark:text-neutral-200 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-all hover:shadow-xl active:scale-95 disabled:opacity-50"
        title={t('callStaff.title')}
        data-testid="call-staff-fab"
      >
        {createWaiterCall.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ConciergeBell className="h-3 w-3" />
        )}
        <span>{t('callStaff.title')}</span>
      </button>
    </>
  );
}
