'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

type CallType = 'assistance' | 'bill' | 'cutlery' | 'complaint' | 'question' | 'emergency';
type CallPriority = 'low' | 'normal' | 'medium' | 'high' | 'urgent';

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
  color: string;
}

const CALL_REASONS: CallReason[] = [
  {
    id: 'assistance',
    icon: '💬',
    label: 'Need Assistance',
    priority: 'normal',
    color: 'bg-blue-500',
  },
  {
    id: 'bill',
    icon: '🧾',
    label: 'Request Bill',
    priority: 'normal',
    color: 'bg-green-500',
  },
  {
    id: 'question',
    icon: '❓',
    label: 'Have a Question',
    priority: 'normal',
    color: 'bg-purple-500',
  },
  {
    id: 'complaint',
    icon: '⚠️',
    label: 'Have a Complaint',
    priority: 'high',
    color: 'bg-orange-500',
  },
  {
    id: 'emergency',
    icon: '🚨',
    label: 'Emergency',
    priority: 'urgent',
    color: 'bg-red-500 animate-pulse',
  },
];

export function CallStaffModal({ tableId, isOpen, onClose }: CallStaffModalProps) {
  const [selectedReason, setSelectedReason] = useState<CallReason | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    setSuccessMessage('');

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('waiter_calls')
        .insert({
          table_id: tableId,
          reason: additionalNotes || selectedReason.label,
          call_type: selectedReason.id,
          priority: selectedReason.priority,
          status: 'pending',
        });

      if (error) throw error;

      setSuccessMessage('Staff has been notified! They will be with you shortly.');
      setTimeout(() => {
        onClose();
        setSelectedReason(null);
        setAdditionalNotes('');
        setSuccessMessage('');
      }, 2000);
    } catch (error) {
      console.error('Error calling staff:', error);
      alert('Failed to call staff. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Call Staff</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {successMessage ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg text-green-600 font-medium">
                {successMessage}
              </p>
            </div>
          ) : (
            <>
              {/* Select Reason */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Please select the reason for calling staff:
                </p>
                <div className="space-y-3">
                  {CALL_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        selectedReason?.id === reason.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-3xl">{reason.icon}</div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{reason.label}</div>
                        {reason.priority === 'high' && (
                          <div className="text-xs text-orange-600">High Priority</div>
                        )}
                        {reason.priority === 'urgent' && (
                          <div className="text-xs text-red-600 font-bold">URGENT</div>
                        )}
                      </div>
                      {selectedReason?.id === reason.id && (
                        <div className="text-blue-500">
                          <svg
                            className="w-6 h-6"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Notes */}
              {selectedReason && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any additional details you'd like to share..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    maxLength={200}
                  />
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {additionalNotes.length}/200
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedReason || isSubmitting}
                  className={`flex-1 ${
                    selectedReason?.priority === 'urgent'
                      ? 'bg-red-500 hover:bg-red-600'
                      : selectedReason?.priority === 'high'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-blue-500 hover:bg-blue-600'
                  } text-white`}
                >
                  {isSubmitting ? 'Calling...' : 'Call Staff'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


