'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import * as Sentry from '@sentry/nextjs';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getFeedbackTypeInfo,
  useFeedback,
  useMarkFeedbackRead,
  usePendingFeedbackCount,
} from '@/hooks';
import { useAuthStore } from '@/store/auth-store';

type FeedbackTab = 'pending' | 'acknowledged';

export default function FeedbackPage() {
  const { t, i18n } = useTranslation('staff');
  const [selectedTab, setSelectedTab] = useState<FeedbackTab>('pending');
  const { staff } = useAuthStore();

  const { data: feedback, isLoading } = useFeedback(selectedTab);
  const { data: pendingCount } = usePendingFeedbackCount();
  const markRead = useMarkFeedbackRead();

  const handleMarkRead = async (feedbackId: string) => {
    if (!staff?.id) {
      toast.error(t('feedback.failedMarkRead'));
      return;
    }
    try {
      await markRead.mutateAsync({ feedbackId, staffId: staff.id });
      toast.success(t('feedback.markedAsRead'));
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('feedback.failedMarkRead'));
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
          <div className="flex">
            {[
              {
                value: 'pending' as FeedbackTab,
                label: t('feedback.unreadTab'),
                count: pendingCount,
              },
              { value: 'acknowledged' as FeedbackTab, label: t('feedback.readTab') },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setSelectedTab(tab.value)}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-medium border-b-2 transition-colors ${
                  selectedTab === tab.value
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
            {feedback.map(
              (item: (typeof feedback)[number] & { table?: { table_number: string } }) => {
                const typeInfo = getFeedbackTypeInfo(item.feedback_type);

                return (
                  <div key={item.id} className="bg-white rounded-lg shadow-sm border p-3 sm:p-6">
                    <div className="flex items-start gap-2 sm:gap-4">
                      <div className="text-2xl sm:text-3xl flex-shrink-0">{typeInfo.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="font-semibold text-sm sm:text-lg">{typeInfo.label}</h3>
                          <span
                            className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs font-medium rounded-full ${
                              item.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {item.status === 'pending'
                              ? t('feedback.status.pending')
                              : t('feedback.status.read')}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">
                          {item.table && <span>🪑 {item.table.table_number}</span>}
                          <span>📅 {formatDateTime(item.created_at)}</span>
                        </div>
                        <p className="text-xs sm:text-base text-gray-700 whitespace-pre-wrap">
                          {item.message}
                        </p>

                        {item.status === 'pending' && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              onClick={() => handleMarkRead(item.id)}
                              disabled={markRead.isPending}
                              className="text-xs sm:text-sm"
                            >
                              ✓ {t('feedback.markRead')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    </div>
  );
}
