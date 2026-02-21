'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type FeedbackType =
  | 'complaint_food'
  | 'complaint_service'
  | 'complaint_staff'
  | 'question_menu'
  | 'request_general'
  | 'praise';
type FeedbackInsert = Database['public']['Tables']['customer_feedback']['Insert'];

interface FeedbackFormProps {
  tableId: string;
  orderId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const FEEDBACK_TYPES: Array<{ value: FeedbackType; label: string; icon: string }> = [
  { value: 'complaint_food', label: 'Issue with Food Quality', icon: '🍽️' },
  { value: 'complaint_service', label: 'Issue with Service', icon: '⚠️' },
  { value: 'complaint_staff', label: 'Issue with Staff', icon: '👤' },
  { value: 'question_menu', label: 'Question about Menu', icon: '❓' },
  { value: 'request_general', label: 'General Request', icon: '📝' },
  { value: 'praise', label: 'Give a Compliment', icon: '⭐' },
];

export function FeedbackForm({ tableId, orderId, onSuccess, onCancel }: FeedbackFormProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('request_general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      alert('Please enter your feedback message');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const feedbackData: FeedbackInsert = {
        table_id: tableId,
        order_id: orderId || null,
        feedback_type: feedbackType,
        subject: subject.trim() || null,
        message: message.trim(),
        status: 'pending',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('customer_feedback').insert(feedbackData);

      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h3>
        <p className="text-gray-600">
          Your feedback has been sent to our staff.
          <br />
          We appreciate your input!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Feedback Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What would you like to share?
        </label>
        <div className="grid grid-cols-1 gap-3">
          {FEEDBACK_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFeedbackType(type.value)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                feedbackType === type.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-2xl">{type.icon}</div>
              <div className="flex-1 font-medium text-gray-900">{type.label}</div>
              {feedbackType === type.value && (
                <div className="text-blue-500">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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

      {/* Subject (Optional) */}
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
          Subject (Optional)
        </label>
        <input
          type="text"
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief title for your feedback"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={255}
        />
      </div>

      {/* Message (Required) */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
          Your Message *
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Please describe your feedback in detail..."
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
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
          disabled={isSubmitting || !message.trim()}
        >
          {isSubmitting ? 'Sending...' : 'Submit Feedback'}
        </Button>
      </div>
    </form>
  );
}
