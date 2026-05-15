'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { NumberInput } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useCreateTable, useUpdateTable } from '@/hooks';
import { apiRoutes } from '@/lib/api-routes';
import { toastLocalizedError } from '@/lib/toast/localized-error';
import type { Tables } from '@/types';

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  table?: Tables; // If provided, we're editing; otherwise creating
}

export function TableModal({ isOpen, onClose, onSuccess, table }: TableModalProps) {
  const { t } = useTranslation('staff');
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();

  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'free' | 'occupied' | 'reserved' | 'closed'>('free');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rotating, setRotating] = useState(false);

  const isEditing = !!table;

  // Populate form when editing
  useEffect(() => {
    if (table) {
      setTableNumber(table.table_number || '');
      setCapacity(table.capacity || 4);
      setLocation(table.location || '');
      setStatus(table.status || 'free');
      setIsActive(table.is_active ?? true);
    } else {
      // Reset form for new table
      setTableNumber('');
      setCapacity(4);
      setLocation('');
      setStatus('free');
      setIsActive(true);
    }
  }, [table]);

  const handleRotateQr = async () => {
    if (!table) return;
    // window.confirm is the simplest "are you sure" gate that doesn't need
    // a separate modal. The Rotate-QR action is destructive (existing
    // printed stickers stop working immediately) so requiring an explicit
    // confirm matters more than the prettier UX.
    if (!window.confirm(t('tables.rotateQrConfirm'))) return;

    setRotating(true);
    try {
      await apiRoutes.tables.rotateQr(table.id);
      toast.success(t('tables.rotateQrSuccess'));
      // Bubble up so the parent refetches the list and picks up the new
      // qr_code value for any subsequent print/preview UI.
      onSuccess();
    } catch (err) {
      Sentry.captureException(err);
      toastLocalizedError(err, t('tables.rotateQrFailed'));
    } finally {
      setRotating(false);
    }
  };

  const isValid = tableNumber.trim().length > 0 && capacity >= 1 && capacity <= 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading || rotating) return;
    setLoading(true);

    try {
      if (isEditing) {
        await updateTable.mutateAsync({
          id: table.id,
          updates: {
            table_number: tableNumber,
            capacity,
            location: location || null,
            status,
            is_active: isActive,
          },
        });
        toast.success(t('tables.tableUpdated'));
      } else {
        const qrCode = crypto.randomUUID();

        await createTable.mutateAsync({
          table_number: tableNumber,
          capacity,
          location: location || null,
          status,
          is_active: isActive,
          qr_code: qrCode,
          current_session_id: null,
          occupied_at: null,
          notes: null,
        });
        toast.success(t('tables.tableCreated'));
      }
      onSuccess();
    } catch (error: unknown) {
      toastLocalizedError(error, t('tables.failedSaveTable'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isEditing
              ? t('tables.editTable', { table: table.table_number })
              : t('tables.addNewTable')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tables.tableNumber')} *
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('tables.tableNumberPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tables.capacitySeats')} *
            </label>
            <NumberInput
              value={capacity}
              onChange={(v) => setCapacity(parseInt(v, 10) || 1)}
              min={1}
              max={20}
              integer
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('tables.locationZone')}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('tables.locationPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('status', { ns: 'common' })}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="free">{t('tables.free')}</option>
              <option value="occupied">{t('tables.occupied')}</option>
              <option value="reserved">{t('tables.reserved')}</option>
              <option value="closed">{t('tables.closed')}</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              {t('tables.tableActive')}
            </label>
          </div>

          {isEditing && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleRotateQr}
                disabled={loading || rotating}
                className="w-full flex items-center justify-center gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                <RefreshCw className={`h-4 w-4 ${rotating ? 'animate-spin' : ''}`} />
                {t('tables.rotateQr')}
              </Button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading || rotating}
              className="flex-1"
            >
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={!isValid || loading || rotating} className="flex-1">
              {loading
                ? isEditing
                  ? `${t('save', { ns: 'common' })}...`
                  : `${t('loading', { ns: 'common' })}...`
                : isEditing
                  ? t('saveChanges', { ns: 'common' })
                  : t('tables.addNewTable')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
