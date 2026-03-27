'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { Button } from '@cafe-idare/ui';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getFeedbackTypeInfo,
  useAcknowledgeFeedback,
  useDismissFeedback,
  useFeedback,
  usePendingFeedbackCount,
  useRespondToFeedback,
} from '@/hooks';
import { useAuthStore } from '@/store/auth-store';

type FeedbackStatus = 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
type CustomerFeedbackWithTable = any;

export default function FeedbackPage() {
  const { t, i18n } = useTranslation('staff');
  const [selectedStatus, setSelectedStatus] = useState<FeedbackStatus | 'all'>('pending');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  const { staff } = useAuthStore();

  const { data: feedback, isLoading } = useFeedback(
    selectedStatus === 'all' ? undefined : selectedStatus,
  );
  const { data: pendingCount } = usePendingFeedbackCount();

  const acknowledgeFeedback = useAcknowledgeFeedback();
  const respondToFeedback = useRespondToFeedback();
  const dismissFeedback = useDismissFeedback();

  const handleAcknowledge = async (feedbackId: string) => {
    if (!staff?.id) {
      toast.error(t('feedback.failedAcknowledge'));
      return;
    }
    try {
      await acknowledgeFeedback.mutateAsync({ feedbackId, staffId: staff.id });
      toast.success(t('feedback.feedbackAcknowledged'));
    } catch (error) {
      console.error('Error acknowledging feedback:', error);
      toast.error(t('feedback.failedAcknowledge'));
    }
  };

  const handleRespond = async (feedbackId: string) => {
    if (!responseText.trim()) return;
    if (!staff?.id) {
      toast.error(t('feedback.failedRespond'));
      return;
    }
    try {
      await respondToFeedback.mutateAsync({
        feedbackId,
        staffId: staff.id,
        response: responseText.trim(),
        status: 'resolved',
      });
      setRespondingTo(null);
      setResponseText('');
      toast.success(t('feedback.responseSent'));
    } catch (error) {
      console.error('Error responding to feedback:', error);
      toast.error(t('feedback.failedRespond'));
    }
  };

  const handleDismiss = async (feedbackId: string) => {
    if (!confirm(t('feedback.dismissConfirm'))) return;
    try {
      await dismissFeedback.mutateAsync(feedbackId);
      toast.success(t('feedback.feedbackDismissed'));
    } catch (error) {
      console.error('Error dismissing feedback:', error);
      toast.error(t('feedback.failedDismiss'));
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const locale = i18n.language || 'en';
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: FeedbackStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'acknowledged':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            {t('feedback.title')}
          </h1>
          <p className="text-sm sm:text-base text-gray-600">{t('feedback.subtitle')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border mb-4 sm:mb-6">
          <div className="flex overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            {[
              { value: 'all', label: t('feedback.allTab') },
              { value: 'pending', label: t('feedback.pendingTab'), count: pendingCount },
              { value: 'acknowledged', label: t('feedback.acknowledgedTab') },
              { value: 'resolved', label: t('feedback.resolvedTab') },
              { value: 'dismissed', label: t('feedback.dismissedTab') },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedStatus(tab.value as FeedbackStatus | 'all')}
                className={`flex-shrink-0 px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors ${
                  selectedStatus === tab.value
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 sm:py-12">
            <div className="inline-block animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">
              {t('loading', { ns: 'common' })}...
            </p>
          </div>
        ) : !feedback || feedback.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 sm:p-12 text-center">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📝</div>
            <p className="text-sm sm:text-base text-gray-600">{t('feedback.noFeedback')}</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {feedback.map((item: CustomerFeedbackWithTable) => {
              const typeInfo = getFeedbackTypeInfo(item.feedback_type);
              const isResponding = respondingTo === item.id;

              return (
                <div key={item.id} className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex items-start gap-2 sm:gap-4 flex-1">
                      <div className="text-2xl sm:text-3xl flex-shrink-0">{typeInfo.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="font-semibold text-sm sm:text-lg">
                            {item.subject || typeInfo.label}
                          </h3>
                          <span
                            className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(item.status)}`}
                          >
                            {t(`feedback.status.${item.status}`)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                          {item.table && <span>🪑 {item.table.table_number}</span>}
                          <span>📅 {formatDateTime(item.created_at)}</span>
                        </div>
                        <p className="text-xs sm:text-base text-gray-700 whitespace-pre-wrap">
                          {item.message}
                        </p>
                      </div>
                    </div>
                  </div>

                  {item.response && (
                    <div className="ml-0 sm:ml-14 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                        <span className="text-xs sm:text-sm font-medium text-blue-900">
                          {t('feedback.staffResponse')}
                        </span>
                        {item.responded_by_staff && (
                          <span className="text-xs sm:text-sm text-blue-700">
                            {t('feedback.by')} {item.responded_by_staff.full_name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-gray-700">{item.response}</p>
                    </div>
                  )}

                  {isResponding && (
                    <div className="ml-0 sm:ml-14 mb-3 sm:mb-4">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder={t('feedback.writeResponse')}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                        rows={3}
                        maxLength={500}
                      />
                      <div className="text-xs text-gray-500 mt-1">{responseText.length}/500</div>
                    </div>
                  )}

                  <div className="ml-0 sm:ml-14 flex flex-wrap gap-2">
                    {item.status === 'pending' && !isResponding && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledge(item.id)}
                          disabled={acknowledgeFeedback.isPending}
                          className="text-xs sm:text-sm"
                        >
                          👁️ <span className="hidden sm:inline">{t('feedback.acknowledge')}</span>
                          <span className="sm:hidden">{t('feedback.ackShort')}</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setRespondingTo(item.id)}
                          className="text-xs sm:text-sm"
                        >
                          💬 {t('feedback.respond')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 text-xs sm:text-sm"
                          onClick={() => handleDismiss(item.id)}
                          disabled={dismissFeedback.isPending}
                        >
                          ✕ {t('feedback.dismiss')}
                        </Button>
                      </>
                    )}

                    {item.status === 'acknowledged' && !isResponding && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => setRespondingTo(item.id)}
                          className="text-xs sm:text-sm"
                        >
                          💬{' '}
                          <span className="hidden sm:inline">{t('feedback.respondResolve')}</span>
                          <span className="sm:hidden">{t('feedback.respond')}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 text-xs sm:text-sm"
                          onClick={() => handleDismiss(item.id)}
                          disabled={dismissFeedback.isPending}
                        >
                          ✕ {t('feedback.dismiss')}
                        </Button>
                      </>
                    )}

                    {isResponding && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleRespond(item.id)}
                          disabled={!responseText.trim() || respondToFeedback.isPending}
                          className="text-xs sm:text-sm"
                        >
                          {respondToFeedback.isPending
                            ? t('feedback.sending')
                            : t('feedback.sendResponse')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRespondingTo(null);
                            setResponseText('');
                          }}
                          disabled={respondToFeedback.isPending}
                          className="text-xs sm:text-sm"
                        >
                          {t('cancel', { ns: 'common' })}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
