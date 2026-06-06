'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { Loader2, Minus, Plus } from 'lucide-react';
import type { OrderItem } from '@/components/tables/use-table-detail';

interface CancelItemModalProps {
  cancelItemConfirm: OrderItem;
  cancelItemQty: number;
  setCancelItemQty: (updater: (q: number) => number) => void;
  cancellingItem: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelItemModal({
  cancelItemConfirm,
  cancelItemQty,
  setCancelItemQty,
  cancellingItem,
  onClose,
  onConfirm,
}: CancelItemModalProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-sm w-full p-6">
        <h3 className="text-lg font-bold mb-2">{t('orders.cancelItem')}</h3>
        <p className="text-sm text-gray-600 mb-4">
          {t('orders.cancelItemConfirm')} <strong>{cancelItemConfirm.item_name}</strong>?
        </p>

        {/* Quantity selector — only show if item has quantity > 1 */}
        {cancelItemConfirm.quantity > 1 && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.cancelQuantity')}
            </label>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setCancelItemQty((q) => Math.max(1, q - 1))}
                disabled={cancelItemQty <= 1}
                className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-lg font-bold w-8 text-center">{cancelItemQty}</span>
              <button
                onClick={() => setCancelItemQty((q) => Math.min(cancelItemConfirm.quantity, q + 1))}
                disabled={cancelItemQty >= cancelItemConfirm.quantity}
                className="h-8 w-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-500">/ {cancelItemConfirm.quantity}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={cancellingItem}>
            {t('orders.keepItem')}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={cancellingItem}
          >
            {cancellingItem ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `${t('orders.cancelItem')} (${cancelItemQty})`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
