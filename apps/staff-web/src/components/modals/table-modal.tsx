'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { NumberInput } from '@/components/ui/number-input';
import { useCreateTable, useUpdateTable } from '@/hooks';

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  table?: any; // If provided, we're editing; otherwise creating
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const message = error instanceof Error ? error.message : t('tables.failedSaveTable');
      toast.error(message);
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
              required
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
              required
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

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
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
