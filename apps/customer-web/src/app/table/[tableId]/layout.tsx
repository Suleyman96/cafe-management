'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { ConciergeBell } from 'lucide-react';
import { useState } from 'react';
import { CallStaffModal } from '@/components/waiter/call-staff-modal';

export default function TableLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tableId: string };
}) {
  const { t } = useTranslation('customer');
  const [showCallStaff, setShowCallStaff] = useState(false);

  return (
    <>
      {children}

      <button
        onClick={() => setShowCallStaff(true)}
        className="fixed bottom-5 left-3 z-40 flex items-center gap-1 rounded-full bg-white/90 dark:bg-neutral-800/90 px-2.5 py-1.5 text-[10px] font-medium text-neutral-700 dark:text-neutral-200 shadow-lg ring-1 ring-black/5 backdrop-blur-sm transition-all hover:shadow-xl active:scale-95"
        title={t('callStaff.title')}
      >
        <ConciergeBell className="h-3 w-3" />
        <span>{t('callStaff.title')}</span>
      </button>

      <CallStaffModal
        tableId={params.tableId}
        isOpen={showCallStaff}
        onClose={() => setShowCallStaff(false)}
      />
    </>
  );
}
