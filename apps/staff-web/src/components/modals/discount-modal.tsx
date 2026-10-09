'use client';

import { DEFAULT_REFUND_TYPE_CONFIRM_THRESHOLD } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useCafeSettings } from '@gustri/queries';
import { Button, NumberInput } from '@gustri/ui-web';
import { Percent, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useApplyDiscount } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useCanPerform } from '@/hooks/use-can-perform';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useIsOnline } from '@/hooks/use-is-online';
import { usePersistentClientRequestId } from '@/hooks/use-persistent-client-request-id';
import { toastLocalizedError } from '@/lib/toast/localized-error';
import { ConfirmRefundModal } from './confirm-refund-modal';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderSubtotal: number;
  currentDiscountType?: 'none' | 'percentage' | 'fixed';
  currentDiscountValue?: number;
  onSuccess: () => void;
  /** Order display id for the confirm summary (e.g. "#ab12cd34"). */
  orderLabel?: string;
  /** Table number / takeout / delivery label for the confirm summary. */
  orderContextLabel?: string;
  /** Customer name for delivery / takeout orders. */
  customerName?: string | null;
}

export function DiscountModal({
  isOpen,
  onClose,
  orderId,
  orderSubtotal,
  currentDiscountType = 'none',
  currentDiscountValue = 0,
  onSuccess,
  orderLabel,
  orderContextLabel,
  customerName,
}: DiscountModalProps) {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const formatPrice = useFormatPrice();
  const applyDiscount = useApplyDiscount();
  const isOnline = useIsOnline();
  const canApplyDiscount = useCanPerform('apply_discount');
  const { data: cafeSettings } = useCafeSettings();
  // The threshold is shared with refund: a tenant that wants to gate a
  // £200 refund behind type-to-confirm equally wants to gate a £200
  // discount override. Same column, same UX.
  const threshold =
    cafeSettings?.refund_type_to_confirm_threshold ?? DEFAULT_REFUND_TYPE_CONFIRM_THRESHOLD;
  // Apply and remove are logically distinct mutations even though they
  // share the `useApplyDiscount` hook (remove sends `discount_type:'none'`,
  // value `0`). The server dedupes per `(tenant_id, order_id, action,
  // client_request_id)` and treats both as `action='discount_applied'`,
  // so reusing the same key across paths would let an apply-then-remove
  // double-tap return the apply result and silently keep the discount.
  // Two persistent keys — one per path — each reset on its own success.
  // Persistence (sessionStorage) means a network error → modal close → reopen
  // replays the same id and the server's idempotency catches the duplicate.
  const applyIdempotencyKey = usePersistentClientRequestId(`discount:apply:${orderId}`);
  const removeIdempotencyKey = usePersistentClientRequestId(`discount:remove:${orderId}`);

  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(
    currentDiscountType === 'none' ? 'percentage' : (currentDiscountType as 'percentage' | 'fixed'),
  );
  const [discountValue, setDiscountValue] = useState(
    currentDiscountValue > 0 ? currentDiscountValue.toString() : '',
  );
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const parsedValue = parseFloat(discountValue) || 0;
  const isPending = applyDiscount.isPending;
  // Continue navigates to the confirm step; isPending gates the confirm
  // CTA. Remove fires the mutation directly from step 1, so it still
  // needs isPending.
  const continueGateDisabled = !isOnline || !canApplyDiscount;
  const removeDisabled = isPending || !isOnline || !canApplyDiscount;

  // Calculate preview
  const discountAmount =
    discountType === 'percentage'
      ? Math.min(orderSubtotal, (orderSubtotal * parsedValue) / 100)
      : Math.min(orderSubtotal, parsedValue);

  const handleClose = () => {
    setStep('form');
    onClose();
  };

  const handleContinue = () => {
    if (parsedValue <= 0 || continueGateDisabled) return;
    if (discountType === 'percentage' && parsedValue > 100) {
      toast.error(t('orders.discountExceedsSubtotal'));
      return;
    }
    setStep('confirm');
  };

  const handleConfirmedApply = async () => {
    if (parsedValue <= 0 || !staff?.id) return;
    if (discountType === 'percentage' && parsedValue > 100) {
      toast.error(t('orders.discountExceedsSubtotal'));
      setStep('form');
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
      handleClose();
    } catch (error: unknown) {
      // `discount_reason_required` is raised by the server when an
      // admin override (>cap, >threshold) is missing a reason. It is not
      // a registered sentinel — its translation lives under `staff.orders`,
      // not the `errors` namespace — so handle it inline before
      // delegating to the generic helper.
      if (error instanceof Error && error.message === 'discount_reason_required') {
        toast.error(t('orders.discountReasonRequired'), {
          id: 'discount_reason_required',
        });
      } else {
        toastLocalizedError(error, t('somethingWentWrong', { ns: 'common' }));
      }
      // Stay on the confirm step so a retry reuses the same request id.
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
      handleClose();
    } catch (error: unknown) {
      toastLocalizedError(error, t('somethingWentWrong', { ns: 'common' }));
    }
  };

  if (!isOpen) return null;

  if (step === 'confirm') {
    const summary: { label: string; value: string }[] = [];
    if (orderLabel) summary.push({ label: t('orders.orderId'), value: orderLabel });
    if (orderContextLabel) summary.push({ label: t('orders.orderType'), value: orderContextLabel });
    if (customerName) summary.push({ label: t('orders.customer'), value: customerName });
    summary.push({
      label: t('orders.discountType'),
      value:
        discountType === 'percentage'
          ? `${parsedValue}% (${formatPrice(discountAmount)})`
          : formatPrice(discountAmount),
    });
    summary.push({
      label: t('subtotal', { ns: 'common' }),
      value: `${formatPrice(orderSubtotal)} → ${formatPrice(orderSubtotal - discountAmount)}`,
    });

    return (
      <ConfirmRefundModal
        isOpen
        intent="discount"
        amount={discountAmount}
        amountFormatted={formatPrice(discountAmount)}
        threshold={threshold}
        summary={summary}
        reason={reason || null}
        isPending={isPending}
        onBack={() => setStep('form')}
        onCancel={handleClose}
        onConfirm={handleConfirmedApply}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-bold">{t('orders.addDiscount')}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
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
              maxLength={500}
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
              disabled={removeDisabled}
              className="text-red-600"
            >
              {t('orders.removeDiscount')}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} disabled={isPending} className="flex-1">
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            onClick={handleContinue}
            disabled={parsedValue <= 0 || continueGateDisabled}
            className="flex-1"
          >
            {t('continue', { ns: 'common' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
