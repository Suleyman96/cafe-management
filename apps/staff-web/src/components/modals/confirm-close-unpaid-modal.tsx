'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { VersionConflictBanner } from '@/components/orders/version-conflict-banner';
import { isOrderVersionConflict, useCloseOrder } from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';

// Mirrors the small enum the migration header documents. `other` requires
// a free-text note so reconciliation (Plan 14) can categorize edge cases
// without losing the operator's reasoning.
type ReasonCode = 'comped' | 'walk_out' | 'staff_meal' | 'other';

const REASON_OPTIONS: ReadonlyArray<{ code: ReasonCode; labelKey: string }> = [
  { code: 'comped', labelKey: 'orders.closeUnpaid.reasonComped' },
  { code: 'walk_out', labelKey: 'orders.closeUnpaid.reasonWalkOut' },
  { code: 'staff_meal', labelKey: 'orders.closeUnpaid.reasonStaffMeal' },
  { code: 'other', labelKey: 'orders.closeUnpaid.reasonOther' },
];

interface ConfirmCloseUnpaidModalProps {
  isOpen: boolean;
  orderId: string;
  /** Display label for the order (e.g. table number, "Delivery", "Takeout") */
  orderLabel: string;
  /** Outstanding balance in tenant currency. Shown to the operator before they confirm. */
  remainingAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfirmCloseUnpaidModal({
  isOpen,
  orderId,
  orderLabel,
  remainingAmount,
  onClose,
  onSuccess,
}: ConfirmCloseUnpaidModalProps) {
  const { t } = useTranslation('staff');
  const formatPrice = useFormatPrice();
  const closeOrder = useCloseOrder();

  const [selectedReason, setSelectedReason] = useState<ReasonCode | null>(null);
  const [otherNote, setOtherNote] = useState('');

  if (!isOpen) return null;

  // `other` requires a non-empty note so reconciliation surfaces a real
  // explanation rather than the literal string "other".
  const otherNoteTrimmed = otherNote.trim();
  const otherNoteValid = selectedReason !== 'other' || otherNoteTrimmed.length > 0;
  const canSubmit = selectedReason !== null && otherNoteValid && !closeOrder.isPending;

  const reasonLabel = (code: ReasonCode) =>
    t(REASON_OPTIONS.find((o) => o.code === code)?.labelKey ?? '');

  const submit = async (override: boolean) => {
    if (!selectedReason) return;
    const reasonValue = selectedReason === 'other' ? `other: ${otherNoteTrimmed}` : selectedReason;
    try {
      await closeOrder.mutateAsync({ orderId, forceCloseReason: reasonValue, override });
      toast.success(t('orders.closeUnpaid.closed'));
      onSuccess();
    } catch (_error) {
      // The global mutation onError already surfaces the localized
      // ConflictError toast. Keep the modal open so the operator can
      // adjust their choice rather than losing the in-progress note.
      // version_conflict is handled inline below via VersionConflictBanner.
    }
  };

  const handleSubmit = () => submit(false);
  const handleOverride = () => submit(true);
  const handleRefresh = () => closeOrder.reset();

  const showConflict = isOrderVersionConflict(closeOrder.error);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-amber-700 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('orders.closeUnpaid.title')}
          </h2>
          <button
            onClick={onClose}
            disabled={closeOrder.isPending}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="font-medium text-amber-900">{orderLabel}</p>
          <p className="text-sm text-amber-800 mt-1">
            {t('orders.closeUnpaid.remaining', { amount: formatPrice(remainingAmount) })}
          </p>
        </div>

        {showConflict && (
          <VersionConflictBanner
            onRefresh={handleRefresh}
            onOverride={handleOverride}
            disabled={closeOrder.isPending}
          />
        )}

        <p className="text-sm text-gray-600 mb-3">{t('orders.closeUnpaid.prompt')}</p>

        <div className="space-y-2 mb-4">
          {REASON_OPTIONS.map((opt) => (
            <label
              key={opt.code}
              className={`flex items-center gap-3 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                selectedReason === opt.code
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="close-unpaid-reason"
                value={opt.code}
                checked={selectedReason === opt.code}
                onChange={() => setSelectedReason(opt.code)}
                disabled={closeOrder.isPending}
                className="text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-gray-900">{reasonLabel(opt.code)}</span>
            </label>
          ))}
        </div>

        {selectedReason === 'other' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orders.closeUnpaid.otherNote')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={otherNote}
              onChange={(e) => setOtherNote(e.target.value)}
              placeholder={t('orders.closeUnpaid.otherNotePlaceholder')}
              disabled={closeOrder.isPending}
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none disabled:bg-gray-50"
              rows={3}
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={closeOrder.isPending}
          >
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {closeOrder.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('orders.closeUnpaid.closing')}
              </>
            ) : (
              t('orders.closeUnpaid.confirm')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
