'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { Loader2, X, XCircle } from 'lucide-react';

interface CancelOrderModalProps {
  cancelReason: string;
  setCancelReason: (reason: string) => void;
  cancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelOrderModal({
  cancelReason,
  setCancelReason,
  cancelling,
  onClose,
  onConfirm,
}: CancelOrderModalProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-red-600">{t('orders.cancelOrder')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-4">{t('orders.reasonRequired')}</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('orders.cancellationReason')} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t('orders.reasonPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={cancelling}>
            {t('orders.keepOrder')}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={cancelling || !cancelReason.trim()}
          >
            {cancelling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('orders.cancelling')}
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                {t('orders.cancelOrder')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
