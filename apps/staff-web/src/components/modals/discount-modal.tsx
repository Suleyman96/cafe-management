'use client';

import { useTranslation } from '@gustri/i18n';
import { useStableClientRequestId } from '@gustri/queries';
import { Button } from '@gustri/ui';
import { NumberInput } from '@gustri/ui-web';
import { Percent, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useApplyDiscount } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useCanPerform } from '@/hooks/use-can-perform';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useIsOnline } from '@/hooks/use-is-online';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderSubtotal: number;
  currentDiscountType?: 'none' | 'percentage' | 'fixed';
  currentDiscountValue?: number;
  onSuccess: () => void;
}

export function DiscountModal({
  isOpen,
  onClose,
  orderId,
  orderSubtotal,
  currentDiscountType = 'none',
  currentDiscountValue = 0,
  onSuccess,
}: DiscountModalProps) {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const formatPrice = useFormatPrice();
  const applyDiscount = useApplyDiscount();
  const isOnline = useIsOnline();
  const canApplyDiscount = useCanPerform('apply_discount');
  // Apply and remove are logically distinct mutations even though they
  // share the `useApplyDiscount` hook (remove sends `discount_type:'none'`,
  // value `0`). The server dedupes per `(tenant_id, order_id, action,
  // client_request_id)` and treats both as `action='discount_applied'`,
  // so reusing the same key across paths would let an apply-then-remove
  // double-tap return the apply result and silently keep the discount.
  // Two refs — one per path — each reset on its own success.
  const applyIdempotencyKey = useStableClientRequestId();
  const removeIdempotencyKey = useStableClientRequestId();

  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    currentDiscountType === 'none' ? 'percentage' : (currentDiscountType as 'percentage' | 'fixed'),
  );
  const [discountValue, setDiscountValue] = useState(
    currentDiscountValue > 0 ? currentDiscountValue.toString() : '',
  );
  const [reason, setReason] = useState('');

  const parsedValue = parseFloat(discountValue) || 0;
  // The same `idempotencyKey` covers both apply and remove because either
  // is a single user-driven submit cycle and the modal closes on success;
  // a retry of either path reuses the same key so the server (which
  // dedupes via the partial unique index from migration 20260504000002)
  // returns the same audit row instead of writing a duplicate.
  const isPending = applyDiscount.isPending;
  const baseDisabled = isPending || !isOnline || !canApplyDiscount;

  // Calculate preview
  const discountAmount =
    discountType === 'percentage'
      ? Math.min(orderSubtotal, (orderSubtotal * parsedValue) / 100)
      : Math.min(orderSubtotal, parsedValue);

  const handleApply = async () => {
    if (parsedValue <= 0 || !staff?.id) return;
    if (discountType === 'percentage' && parsedValue > 100) {
      toast.error(t('orders.discountExceedsSubtotal'));
      return;
    }

    try {
      await applyDiscount.mutateAsync({
        orderId,
        discount_type: discountType,
        discount_value: parsedValue,
        discount_reason: reason || null,
        discount_applied_by: staff.id,
        client_request_id: applyIdempotencyKey.get(),
      });
      applyIdempotencyKey.reset();
      toast.success(t('orders.discountApplied'));
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : 'Failed to apply discount';
      const message = raw === 'discount_reason_required' ? t('orders.discountReasonRequired') : raw;
      toast.error(message);
    }
  };

  const handleRemove = async () => {
    if (!staff?.id) return;
    try {
      await applyDiscount.mutateAsync({
        orderId,
        discount_type: 'none',
        discount_value: 0,
        discount_reason: null,
        discount_applied_by: staff.id,
        client_request_id: removeIdempotencyKey.get(),
      });
      removeIdempotencyKey.reset();
      toast.success(t('orders.discountRemoved'));
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to remove discount';
      toast.error(message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-bold">{t('orders.addDiscount')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Discount Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.discountType')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('percentage')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  discountType === 'percentage'
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Percent className="h-4 w-4 inline mr-1" />
                {t('orders.percentage')}
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  discountType === 'fixed'
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('orders.fixedAmount')}
              </button>
            </div>
          </div>

          {/* Discount Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.discountValue')}
            </label>
            <NumberInput
              value={discountValue}
              onChange={setDiscountValue}
              step={discountType === 'percentage' ? 1 : 0.01}
              min={0}
              max={discountType === 'percentage' ? 100 : undefined}
              placeholder={discountType === 'percentage' ? '10' : '5.00'}
              suffix={discountType === 'percentage' ? '%' : undefined}
              integer={discountType === 'percentage'}
            />
          </div>

          {/* Preview */}
          {parsedValue > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-700">{t('orders.discount')}</span>
                <span className="font-semibold text-red-600">-{formatPrice(discountAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span className="text-gray-500">
                  {t('subtotal', { ns: 'common' })}: {formatPrice(orderSubtotal)}
                </span>
                <span className="text-gray-500">
                  → {formatPrice(orderSubtotal - discountAmount)}
                </span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.discountReason')}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('orders.discountReason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="border-t p-6 flex gap-3">
          {currentDiscountType !== 'none' && (
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={baseDisabled}
              className="text-red-600"
            >
              {t('orders.removeDiscount')}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            onClick={handleApply}
            disabled={parsedValue <= 0 || baseDisabled}
            className="flex-1"
          >
            {isPending ? t('payment.processing') : t('orders.addDiscount')}
          </Button>
        </div>
      </div>
    </div>
  );
}
