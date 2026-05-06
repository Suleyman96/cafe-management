'use client';

import type { OrderWithDetails } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { Loader2, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { VersionConflictBanner } from '@/components/orders/version-conflict-banner';
import { isOrderVersionConflict, useCancelOrder } from '@/hooks';

interface CancelOrderModalProps {
  order: OrderWithDetails;
  /** Label to display for the order (e.g. table number, "Delivery", "Takeout") */
  orderLabel: string;
  /** Modal title */
  title: string;
  /** Called after successful cancellation */
  onSuccess: () => void;
  /** Called when modal is dismissed */
  onClose: () => void;
}

export function CancelOrderModal({
  order,
  orderLabel,
  title,
  onSuccess,
  onClose,
}: CancelOrderModalProps) {
  const { t } = useTranslation('staff');
  const cancelOrderMutation = useCancelOrder();
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const submit = async (override: boolean) => {
    if (!cancelReason.trim()) {
      toast.error(t('orders.reasonRequired'));
      return;
    }

    setCancelling(true);
    try {
      await cancelOrderMutation.mutateAsync({
        orderId: order.id,
        reason: cancelReason.trim(),
        tableId: order.table_id ?? null,
        override,
      });
      toast.success(t('orders.orderCancelled'));
      onSuccess();
    } catch (error) {
      // version_conflict surfaces inline via VersionConflictBanner; the
      // hook also suppresses the global toast for that sentinel. Other
      // errors are already toasted by the hook's onError — avoid a
      // duplicate generic toast here.
      if (!isOrderVersionConflict(error)) {
        toast.error(t('orders.failedCancel'));
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleCancel = () => submit(false);
  const handleOverride = () => submit(true);
  const handleRefresh = () => cancelOrderMutation.reset();
  const showConflict = isOrderVersionConflict(cancelOrderMutation.error);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-red-600">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="font-medium">{orderLabel}</p>
          <p className="text-sm text-gray-500">#{order.id.slice(0, 8)}</p>
        </div>

        {showConflict && (
          <VersionConflictBanner
            onRefresh={handleRefresh}
            onOverride={handleOverride}
            disabled={cancelling}
          />
        )}

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
            onClick={handleCancel}
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
