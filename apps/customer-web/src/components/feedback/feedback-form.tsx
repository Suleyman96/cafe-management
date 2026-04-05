'use client';

import { useTranslation } from '@gustri/i18n';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/supabase';

type FeedbackType = 'complaint' | 'praise';

interface FeedbackFormProps {
  tableId: string;
  orderId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function FeedbackForm({ tableId, orderId, onSuccess, onCancel }: FeedbackFormProps) {
  const { t } = useTranslation('customer');
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const successTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const FEEDBACK_TYPES: Array<{ value: FeedbackType; label: string; icon: string }> = [
    { value: 'complaint', label: t('feedback.type.complaint'), icon: '😟' },
    { value: 'praise', label: t('feedback.type.praise'), icon: '😊' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedbackType) {
      toast.error(t('feedback.errorNoType'));
      return;
    }

    if (!message.trim()) {
      toast.error(t('feedback.errorEmpty'));
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await db.feedback.create({
        table_id: tableId,
        order_id: orderId || null,
        feedback_type: feedbackType,
        message: message.trim(),
      });

      setShowSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(t('feedback.errorSubmit'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('feedback.successTitle')}</h3>
        <p className="text-gray-600" style={{ whiteSpace: 'pre-line' }}>
          {t('feedback.successMessage')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Feedback Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          {t('feedback.typeLabel')}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {FEEDBACK_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFeedbackType(type.value)}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                feedbackType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-4xl">{type.icon}</div>
              <div className="font-medium text-gray-900 text-center">{type.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Message (Required) */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
          {t('feedback.messageLabel')}
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('feedback.messagePlaceholder')}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          rows={6}
          maxLength={1000}
          required
        />
        <div className="text-xs text-gray-500 mt-1 text-right">{message.length}/1000</div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
          >
            {t('feedback.cancel')}
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
          disabled={isSubmitting || !feedbackType || !message.trim()}
        >
          {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
        </Button>
      </div>
    </form>
  );
}
