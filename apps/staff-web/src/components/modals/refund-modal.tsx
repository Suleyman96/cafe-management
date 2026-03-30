'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { NumberInput } from '@/components/ui/number-input';
import { useCreateRefund } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  totalPaid: number;
  totalRefunded: number;
  onSuccess: () => void;
}

export function RefundModal({
  isOpen,
  onClose,
  orderId,
  totalPaid,
  totalRefunded,
  onSuccess,
}: RefundModalProps) {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const formatPrice = useFormatPrice();
  const createRefund = useCreateRefund();

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [loading, setLoading] = useState(false);

  const available = totalPaid - totalRefunded;
  const parsedAmount = parseFloat(amount) || 0;

  const handleFullRefund = () => {
    setAmount(available.toFixed(2));
  };

  const handleSubmit = async () => {
    if (parsedAmount <= 0 || !reason.trim() || !staff?.id) return;
    if (parsedAmount > available) {
      toast.error(t('orders.refundExceedsAvailable'));
      return;
    }

    setLoading(true);
    try {
      await createRefund.mutateAsync({
        order_id: orderId,
        processed_by: staff.id,
        amount: parsedAmount,
        reason: reason.trim(),
        refund_method: refundMethod,
      });
      toast.success(t('orders.refundProcessed'));
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to process refund';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-bold">{t('orders.processRefund')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={parsedAmount <= 0 || !reason.trim() || parsedAmount > available || loading}
            className="flex-1"
          >
            {loading ? t('payment.processing') : t('orders.processRefund')}
          </Button>
        </div>
      </div>
    </div>
  );
}
