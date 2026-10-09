'use client';

import { DEFAULT_REFUND_TYPE_CONFIRM_THRESHOLD } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useCafeSettings } from '@gustri/queries';
import { Button, NumberInput } from '@gustri/ui-web';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateRefund } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useCanPerform } from '@/hooks/use-can-perform';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useIsOnline } from '@/hooks/use-is-online';
import { usePersistentClientRequestId } from '@/hooks/use-persistent-client-request-id';
import { toastLocalizedError } from '@/lib/toast/localized-error';
import { ConfirmRefundModal } from './confirm-refund-modal';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  totalPaid: number;
  totalRefunded: number;
  onSuccess: () => void;
  /** Order display id for the confirm summary (e.g. "#ab12cd34"). Optional for tests. */
  orderLabel?: string;
  /** Table number / takeout / delivery label for the confirm summary. */
  orderContextLabel?: string;
  /** Customer name for delivery / takeout orders. */
  customerName?: string | null;
}

export function RefundModal({
  isOpen,
  onClose,
  orderId,
  totalPaid,
  totalRefunded,
  onSuccess,
  orderLabel,
  orderContextLabel,
  customerName,
}: RefundModalProps) {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const formatPrice = useFormatPrice();
  const createRefund = useCreateRefund();
  const isOnline = useIsOnline();
  const canIssueRefund = useCanPerform('issue_refund');
  // Keyed by order so a refund retry after error → modal close → reopen for
  // the SAME order replays the same `client_request_id` and hits server-side
  // dedupe on the (tenant_id, client_request_id) partial unique index.
  const idempotencyKey = usePersistentClientRequestId(`refund:${orderId}`);
  const { data: cafeSettings } = useCafeSettings();
  const threshold =
    cafeSettings?.refund_type_to_confirm_threshold ?? DEFAULT_REFUND_TYPE_CONFIRM_THRESHOLD;

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const available = totalPaid - totalRefunded;
  const parsedAmount = parseFloat(amount) || 0;
  // The continue button only navigates to the confirm step — it never
  // fires the mutation. `createRefund.isPending` is gated at the confirm
  // CTA instead. With `retry: 0` (Blocker 2) a failure flips isPending
  // back to false instantly, so the user can retry — and the retry
  // reuses `idempotencyKey.get()` so the server dedupes via the
  // (tenant_id, client_request_id) partial unique index on `refunds`.
  const continueDisabled =
    parsedAmount <= 0 || !reason.trim() || parsedAmount > available || !isOnline || !canIssueRefund;

  const handleFullRefund = () => {
    setAmount(available.toFixed(2));
  };

  const handleContinue = () => {
    if (continueDisabled) return;
    if (parsedAmount > available) {
      toast.error(t('orders.refundExceedsAvailable'));
      return;
    }
    setStep('confirm');
  };

  const handleConfirmedSubmit = async () => {
    if (parsedAmount <= 0 || !reason.trim() || !staff?.id) return;
    if (parsedAmount > available) {
      toast.error(t('orders.refundExceedsAvailable'));
      setStep('form');
      return;
    }

    try {
      await createRefund.mutateAsync({
        order_id: orderId,
        processed_by: staff.id,
        amount: parsedAmount,
        reason: reason.trim(),
        refund_method: refundMethod,
        client_request_id: idempotencyKey.get(),
      });
      idempotencyKey.reset();
      toast.success(t('orders.refundProcessed'));
      onSuccess();
      handleClose();
    } catch (error: unknown) {
      toastLocalizedError(error, t('somethingWentWrong', { ns: 'common' }));
      // Stay on the confirm step so a retry reuses the same request id.
    }
  };

  const handleClose = () => {
    setStep('form');
    onClose();
  };

  if (!isOpen) return null;

  if (step === 'confirm') {
    const summary: { label: string; value: string }[] = [];
    if (orderLabel) summary.push({ label: t('orders.orderId'), value: orderLabel });
    if (orderContextLabel) summary.push({ label: t('orders.orderType'), value: orderContextLabel });
    if (customerName) summary.push({ label: t('orders.customer'), value: customerName });
    summary.push({ label: t('orders.refundMethod'), value: refundMethod });

    return (
      <ConfirmRefundModal
        isOpen
        intent="refund"
        amount={parsedAmount}
        amountFormatted={formatPrice(parsedAmount)}
        threshold={threshold}
        summary={summary}
        reason={reason.trim()}
        isPending={createRefund.isPending}
        onBack={() => setStep('form')}
        onCancel={handleClose}
        onConfirm={handleConfirmedSubmit}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-bold">{t('orders.processRefund')}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('orders.totalPaidAmount')}</span>
              <span className="font-medium">{formatPrice(totalPaid)}</span>
            </div>
            {totalRefunded > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('orders.totalRefundedAmount')}</span>
                <span className="font-medium text-red-600">-{formatPrice(totalRefunded)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-1">
              <span className="text-gray-700 font-medium">{t('orders.availableForRefund')}</span>
              <span className="font-bold">{formatPrice(available)}</span>
            </div>
          </div>

          {/* Refund Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.refundAmount')}
            </label>
            <div className="flex gap-2">
              <NumberInput
                value={amount}
                onChange={setAmount}
                min={0}
                max={available}
                step={0.01}
                placeholder="0.00"
                className="flex-1"
              />
              <button
                type="button"
                onClick={handleFullRefund}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {t('orders.fullRefund')}
              </button>
            </div>
          </div>

          {/* Refund Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.refundMethod')}
            </label>
            <div className="flex gap-2">
              {(['cash', 'card', 'digital'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setRefundMethod(method)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                    refundMethod === method
                      ? 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.refundReason')} *
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              maxLength={500}
              placeholder={t('orders.refundReason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Warning if amount exceeds available */}
          {parsedAmount > available && (
            <p className="text-xs text-red-600">{t('orders.refundExceedsAvailable')}</p>
          )}
        </div>

        <div className="border-t p-6 flex gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={createRefund.isPending}
            className="flex-1"
          >
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            variant="destructive"
            onClick={handleContinue}
            disabled={continueDisabled}
            className="flex-1"
          >
            {t('continue', { ns: 'common' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
