'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import {
  AlertTriangle,
  Check,
  HelpCircle,
  Loader2,
  type LucideIcon,
  MessageSquare,
  Receipt,
  Siren,
  X,
} from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { useCreateWaiterCall, useOpenWaiterCallsForTable } from '@/hooks/use-waiter-call';

type CallType = 'assistance' | 'bill' | 'question' | 'complaint' | 'emergency';
type CallPriority = 'low' | 'normal' | 'high' | 'urgent';

interface CallStaffModalProps {
  tableId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface CallReason {
  id: CallType;
  icon: LucideIcon;
  label: string;
  priority: CallPriority;
}

export function CallStaffModal({ tableId, isOpen, onClose }: CallStaffModalProps) {
  const { t } = useTranslation('customer');
  const [selectedReason, setSelectedReason] = useState<CallReason | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const createWaiterCall = useCreateWaiterCall();
  // H6 — when an open call is already in flight for this table, render
  // the modal in a "notified" mode so the customer sees who staff has
  // been told about + how long ago, instead of getting a no-op submit
  // or a duplicate row in the staff queue.
  const { hasOpenCall, openCall } = useOpenWaiterCallsForTable(tableId);

  // MO3 — parity with Phase 5 modals (menu-item, cancel-order,
  // cancel-item). This is the highest-stakes customer-side modal —
  // urgent calls go through here — so keyboard semantics matter.
  // Esc routes through `handleClose` so the focus-trap teardown runs
  // the same reset path (clear reason / notes / success) as the X.
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const handleClose = () => {
    setSelectedReason(null);
    setAdditionalNotes('');
    setShowSuccess(false);
    onClose();
  };

  useFocusTrap(dialogRef, { active: isOpen, onClose: handleClose });

  // Y2 — Lucide icons instead of emoji. Emoji renders inconsistently
  // across Android fonts and screen readers announce the raw Unicode
  // name (e.g. "money bag" for 🧾) which leaks past the i18n label.
  const CALL_REASONS: CallReason[] = [
    {
      id: 'assistance',
      icon: MessageSquare,
      label: t('callStaff.reason.assistance'),
      priority: 'normal',
    },
    { id: 'bill', icon: Receipt, label: t('callStaff.reason.bill'), priority: 'normal' },
    { id: 'question', icon: HelpCircle, label: t('callStaff.reason.question'), priority: 'normal' },
    {
      id: 'complaint',
      icon: AlertTriangle,
      label: t('callStaff.reason.complaint'),
      priority: 'high',
    },
    { id: 'emergency', icon: Siren, label: t('callStaff.reason.emergency'), priority: 'urgent' },
  ];

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    // H6 — server-side gate. The submit button below is also disabled
    // when an open call exists; this guard catches the keyboard /
    // programmatic path.
    if (hasOpenCall) {
      toast.info(t('callStaff.alreadyNotified'));
      return;
    }

    try {
      await createWaiterCall.mutateAsync({
        tableId,
        callType: selectedReason.id,
        reason: selectedReason.label,
        priority: selectedReason.priority,
        notes: additionalNotes || undefined,
      });

      setShowSuccess(true);
      toast.success(t('callStaff.toastSuccess'));

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('callStaff.toastError'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-card rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto outline-none"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 id={titleId} className="text-2xl font-bold">
              {t('callStaff.title')}
            </h2>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
              aria-label={t('close', { ns: 'common' })}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {showSuccess || hasOpenCall ? (
            /* Success / already-notified state. H6 — when staff has been
               told but not yet responded, the modal opens directly into
               this state instead of letting the customer pick a fresh
               reason that would post a second row. The original call
               type is read off the open `waiter_calls` row. */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-lg font-medium text-green-600 dark:text-green-400">
                {hasOpenCall && openCall
                  ? t('callStaff.alreadyNotified')
                  : t('callStaff.successMessage')}
              </p>
              <p className="text-sm text-muted-foreground mt-2">{t('callStaff.successSubtext')}</p>
            </div>
          ) : (
            <>
              {/* Select Reason */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-4">{t('callStaff.selectReason')}</p>
                <div className="space-y-3">
                  {CALL_REASONS.map((reason) => {
                    const ReasonIcon = reason.icon;
                    const iconColorClass =
                      reason.priority === 'urgent'
                        ? 'text-red-500'
                        : reason.priority === 'high'
                          ? 'text-orange-500'
                          : 'text-muted-foreground';
                    return (
                      <button
                        key={reason.id}
                        onClick={() => setSelectedReason(reason)}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                          selectedReason?.id === reason.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <ReasonIcon className={`h-7 w-7 ${iconColorClass}`} aria-hidden="true" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">{reason.label}</div>
                          {reason.priority === 'high' && (
                            <div className="text-xs text-orange-600 dark:text-orange-400">
                              {t('callStaff.priorityHigh')}
                            </div>
                          )}
                          {reason.priority === 'urgent' && (
                            <div className="text-xs text-red-600 dark:text-red-400 font-bold">
                              {t('callStaff.priorityUrgent')}
                            </div>
                          )}
                        </div>
                        {selectedReason?.id === reason.id && (
                          <div className="text-primary">
                            <Check className="h-5 w-5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Additional Notes */}
              {selectedReason && (
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    {t('callStaff.additionalNotes')}
                  </label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder={t('callStaff.notesPlaceholder')}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full px-4 py-3 border border-input rounded-xl bg-background focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    rows={3}
                    maxLength={200}
                  />
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    {additionalNotes.length}/200
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  onClick={handleClose}
                  variant="outline"
                  className="flex-1"
                  disabled={createWaiterCall.isPending}
                >
                  {t('callStaff.cancel')}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedReason || createWaiterCall.isPending}
                  className={`flex-1 ${
                    selectedReason?.priority === 'urgent'
                      ? 'bg-red-500 hover:bg-red-600'
                      : selectedReason?.priority === 'high'
                        ? 'bg-orange-500 hover:bg-orange-600'
                        : ''
                  }`}
                >
                  {createWaiterCall.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('callStaff.calling')}
                    </>
                  ) : (
                    t('callStaff.callButton')
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
