'use client';

import { useTranslation } from '@gustri/i18n';
import { ConciergeBell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTable } from '@/hooks/use-table';
import { useCreateWaiterCall } from '@/hooks/use-waiter-call';

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

  const handleCallStaff = async () => {
    if (!actualTableId || createWaiterCall.isPending) return;

    try {
      await createWaiterCall.mutateAsync({
        tableId: actualTableId,
        callType: 'assistance',
        reason: t('callStaff.reason.assistance'),
        priority: 'normal',
        tenantId: table?.tenant_id || '',
      });
      toast.success(t('callStaff.toastSuccess'));
    } catch (error) {
      console.error('Error calling staff:', error);
      toast.error(t('callStaff.toastError'));
    }
  };

  return (
    <>
      {children}

      <button
        onClick={handleCallStaff}
        disabled={!actualTableId || createWaiterCall.isPending}
        className="fixed bottom-5 left-3 z-40 flex items-center gap-1 rounded-full bg-white/90 dark:bg-neutral-800/90 px-2.5 py-1.5 text-[10px] font-medium text-neutral-700 dark:text-neutral-200 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-all hover:shadow-xl active:scale-95 disabled:opacity-50"
        title={t('callStaff.title')}
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
