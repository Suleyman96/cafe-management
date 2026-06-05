'use client';

import type { OrdersInsert } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { useStableClientRequestId } from '@gustri/queries';
import { Button } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { UtensilsCrossed, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateOrder } from '@/hooks';
import { useIsOnline } from '@/hooks/use-is-online';

interface CreateTableOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  table: {
    id: string;
    table_number: string;
  };
}

export function CreateTableOrderModal({
  isOpen,
  onClose,
  onSuccess,
  table,
}: CreateTableOrderModalProps) {
  const { t } = useTranslation('staff');
  const createOrder = useCreateOrder();
  const isOnline = useIsOnline();
  const idempotencyKey = useStableClientRequestId();

  const [notes, setNotes] = useState('');
  const loading = createOrder.isPending;

  const handleCreate = async () => {
    try {
      const result = await createOrder.mutateAsync({
        table_id: table.id,
        order_type: 'dine_in',
        status: 'new',
        internal_notes: notes.trim() || null,
        client_request_id: idempotencyKey.get(),
      } as OrdersInsert);
      idempotencyKey.reset();
      onSuccess(result.id);

      // Reset form
      setNotes('');
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('orders.failedCreateOrder'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {t('tables.createOrderFor', { table: table.table_number })}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UtensilsCrossed className="inline h-4 w-4 mr-1" />
              {t('tables.notesOptional')}
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('tables.specialRequests')}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-green-800">
            {t('tables.createOrderHint', { table: table.table_number })}
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={loading || !isOnline}
            className="flex-1"
          >
            {loading ? t('orders.creating') : t('orders.createOrder')}
          </Button>
        </div>
      </div>
    </div>
  );
}
