'use client';

import { useTranslation } from '@gustri/i18n';
import { Check, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCreateWaiterCall } from '@/hooks/use-waiter-call';

type CallType = 'assistance' | 'bill' | 'question' | 'complaint' | 'emergency';
type CallPriority = 'low' | 'normal' | 'high' | 'urgent';

interface CallStaffModalProps {
  tableId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface CallReason {
  id: CallType;
  icon: string;
  label: string;
  priority: CallPriority;
}

export function CallStaffModal({ tableId, isOpen, onClose }: CallStaffModalProps) {
  const { t } = useTranslation('customer');
  const [selectedReason, setSelectedReason] = useState<CallReason | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const createWaiterCall = useCreateWaiterCall();

  const CALL_REASONS: CallReason[] = [
    { id: 'assistance', icon: '💬', label: t('callStaff.reason.assistance'), priority: 'normal' },
    { id: 'bill', icon: '🧾', label: t('callStaff.reason.bill'), priority: 'normal' },
    { id: 'question', icon: '❓', label: t('callStaff.reason.question'), priority: 'normal' },
    { id: 'complaint', icon: '⚠️', label: t('callStaff.reason.complaint'), priority: 'high' },
    { id: 'emergency', icon: '🚨', label: t('callStaff.reason.emergency'), priority: 'urgent' },
  ];

  if (!isOpen) return null;

  const handleClose = () => {
    setSelectedReason(null);
    setAdditionalNotes('');
    setShowSuccess(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;

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
      console.error('Error calling staff:', error);
      toast.error(t('callStaff.toastError'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">{t('callStaff.title')}</h2>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
              aria-label={t('close', { ns: 'common' })}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {showSuccess ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-lg font-medium text-green-600 dark:text-green-400">
                {t('callStaff.successMessage')}
              </p>
              <p className="text-sm text-muted-foreground mt-2">{t('callStaff.successSubtext')}</p>
            </div>
          ) : (
            <>
              {/* Select Reason */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-4">{t('callStaff.selectReason')}</p>
                <div className="space-y-3">
                  {CALL_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        selectedReason?.id === reason.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className="text-3xl">{reason.icon}</div>
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
                  ))}
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
