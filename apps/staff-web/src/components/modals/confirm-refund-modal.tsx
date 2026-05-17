'use client';

import { numberToWords, useLocale, useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import { AlertTriangle, ArrowLeft, X } from 'lucide-react';
import { useMemo, useState } from 'react';

export type ConfirmIntent = 'refund' | 'discount';

interface SummaryRow {
  label: string;
  value: string;
}

interface ConfirmRefundModalProps {
  isOpen: boolean;
  intent: ConfirmIntent;
  amount: number;
  amountFormatted: string;
  threshold: number;
  summary: SummaryRow[];
  reason?: string | null;
  isPending: boolean;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Confirmation step for refund and manual-discount-override modals.
 *
 * Renders the amount in localized currency + words alongside an order
 * summary so a stressed cashier sees what they're actually about to do.
 * Above the tenant's `refund_type_to_confirm_threshold`, a type-to-confirm
 * input is shown — submit is gated until the user types the literal
 * phrase (case-insensitive, trimmed) that matches the intent + amount.
 *
 * The confirmation phrase is intentionally English-only ("REFUND 200" /
 * "DISCOUNT 200"). Translating it would defeat the purpose: if the user
 * is on a Turkish UI and the prompt reads "İADE 200", a typing error in
 * a low-frequency word is more likely than the staff member intending to
 * confirm. The keyword is short, in caps, and the amount is the same
 * digits the user just entered — that's the friction we want.
 *
 * This component owns NO mutation state and NO idempotency key. The
 * parent runs the actual mutation in `onConfirm`; on error, the parent
 * can leave the user on this screen so a retry reuses the same key.
 */
export function ConfirmRefundModal({
  isOpen,
  intent,
  amount,
  amountFormatted,
  threshold,
  summary,
  reason,
  isPending,
  onBack,
  onCancel,
  onConfirm,
}: ConfirmRefundModalProps) {
  const { t } = useTranslation('staff');
  const locale = useLocale();
  const [typed, setTyped] = useState('');

  const requiresTypeMatch = amount >= threshold;

  const requiredPhrase = useMemo(() => {
    const verb = intent === 'refund' ? 'REFUND' : 'DISCOUNT';
    const wholeOrFixed = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
    return `${verb} ${wholeOrFixed}`;
  }, [intent, amount]);

  const phraseMatches =
    typed.trim().toLocaleUpperCase('en-US') === requiredPhrase.toLocaleUpperCase('en-US');

  const submitDisabled = isPending || (requiresTypeMatch && !phraseMatches);

  const titleKey = intent === 'refund' ? 'refunds.confirmTitle' : 'discounts.confirmTitle';
  const ctaKey = intent === 'refund' ? 'refunds.confirmCta' : 'discounts.confirmCta';
  const amountLabelKey = intent === 'refund' ? 'refunds.confirmAmount' : 'discounts.confirmAmount';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isPending}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              aria-label={t('back', { ns: 'common' })}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold">{t(titleKey)}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label={t('cancel', { ns: 'common' })}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center">
            <p className="text-xs uppercase tracking-wide text-red-700 mb-1">{t(amountLabelKey)}</p>
            <p className="text-3xl font-bold text-red-700">{amountFormatted}</p>
            <p className="text-xs text-red-600 mt-1 italic">{numberToWords(amount, locale)}</p>
          </div>

          <div className="rounded-lg border border-gray-200 divide-y">
            {summary.map((row) => (
              <div key={row.label} className="flex justify-between p-3 text-sm">
                <span className="text-gray-600">{row.label}</span>
                <span className="font-medium text-right break-words max-w-[60%]">{row.value}</span>
              </div>
            ))}
            {reason ? (
              <div className="flex justify-between p-3 text-sm">
                <span className="text-gray-600">{t('orders.refundReason')}</span>
                <span className="font-medium text-right break-words max-w-[60%]">{reason}</span>
              </div>
            ) : null}
          </div>

          {requiresTypeMatch ? (
            <div>
              <div className="flex items-start gap-2 mb-2 text-amber-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  {t('refunds.confirmTypePrompt', { phrase: requiredPhrase })}
                </p>
              </div>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={isPending}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={requiredPhrase}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label={t('refunds.confirmTypePrompt', { phrase: requiredPhrase })}
              />
              {typed.length > 0 && !phraseMatches ? (
                <p className="mt-1 text-xs text-red-600">{t('refunds.confirmTypeMismatch')}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t p-6 flex gap-3">
          <Button variant="outline" onClick={onBack} disabled={isPending} className="flex-1">
            {t('back', { ns: 'common' })}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={submitDisabled}
            className="flex-1"
          >
            {isPending ? t('payment.processing') : t(ctaKey)}
          </Button>
        </div>
      </div>
    </div>
  );
}
