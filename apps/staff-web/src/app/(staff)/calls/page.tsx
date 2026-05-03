'use client';

import { useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { Button, LoadingSpinner } from '@gustri/ui';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  DollarSign,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAcknowledgeWaiterCall, useAuth, useResolveWaiterCall, useWaiterCalls } from '@/hooks';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

type FilterStatus = 'all' | 'pending' | 'acknowledged' | 'resolved';

export default function WaiterCallsPage() {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const { data: waiterCalls, isLoading: loading, error, refetch } = useWaiterCalls();
  const acknowledgeCall = useAcknowledgeWaiterCall();
  const resolveCall = useResolveWaiterCall();
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const tenantId = useTenantId();

  // Filter calls based on status
  const filteredCalls = waiterCalls?.filter((call) => {
    if (filter === 'all') return true;
    return call.status === filter;
  });

  // Real-time: invalidate queries on DB changes
  useRealtimeSync('waiter-calls-realtime', [
    {
      table: 'waiter_calls',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS),
        tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS_COUNT),
      ],
    },
  ]);

  // Get icon for call type
  const getCallTypeIcon = (type: string) => {
    switch (type) {
      case 'assistance':
        return <HelpCircle className="h-5 w-5" />;
      case 'bill':
        return <DollarSign className="h-5 w-5" />;
      case 'complaint':
        return <AlertCircle className="h-5 w-5" />;
      case 'question':
        return <MessageSquare className="h-5 w-5" />;
      case 'emergency':
        return <Zap className="h-5 w-5" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  // Get call type color
  const getCallTypeColor = (type: string) => {
    switch (type) {
      case 'emergency':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'complaint':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'bill':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'question':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const callTime = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - callTime.getTime()) / 1000 / 60);

    if (diffMinutes < 1) return t('calls.justNow');
    if (diffMinutes === 1) return t('calls.minuteAgo');
    if (diffMinutes < 60) return t('calls.minutesAgo', { count: diffMinutes });

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return t('calls.hourAgo');
    return t('calls.hoursAgo', { count: diffHours });
  };

  // Get display label for call type
  const getCallTypeLabel = (type: string) => {
    switch (type) {
      case 'bill':
        return t('calls.requestBill');
      case 'assistance':
        return t('calls.assistance');
      case 'complaint':
        return t('calls.complaint');
      case 'question':
        return t('calls.question');
      case 'emergency':
        return t('calls.emergency');
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  // Handle acknowledge call
  const handleAcknowledge = async (callId: string) => {
    if (!staff?.id) return;
    try {
      await acknowledgeCall.mutateAsync({ callId, staffId: staff.id });
      toast.success(t('calls.callAcknowledged'));
    } catch (_error) {
      toast.error(t('calls.failedRespond'));
    }
  };

  // Handle resolve call
  const handleResolve = async (callId: string) => {
    try {
      await resolveCall.mutateAsync({ callId });
      toast.success(t('calls.callCompleted'));
    } catch (_error) {
      toast.error(t('calls.failedRespond'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">{t('calls.errorLoading')}</p>
      </div>
    );
  }

  const pendingCallsCount = waiterCalls?.filter((call) => call.status === 'pending').length || 0;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('calls.title')}</h1>
          {pendingCallsCount > 0 && (
            <p className="text-sm text-orange-600 font-medium">
              {pendingCallsCount} {t('pending', { ns: 'common' }).toLowerCase()}{' '}
              {pendingCallsCount === 1 ? t('calls.call') : t('calls.callsPlural')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" onClick={() => refetch()} size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
            filter === 'pending'
              ? 'bg-orange-100 text-orange-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t('pending', { ns: 'common' })}
        </button>
        <button
          onClick={() => setFilter('acknowledged')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
            filter === 'acknowledged'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t('calls.acknowledged')}
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
            filter === 'resolved'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t('calls.resolved')}
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
            filter === 'all'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {t('all', { ns: 'common' })}
        </button>
      </div>

      {/* Calls List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredCalls?.map(
          (
            call: (typeof filteredCalls)[number] & {
              table?: { table_number: string; location?: string };
            },
          ) => {
            const callType = call.call_type || 'assistance';
            const isEmergency = callType === 'emergency';
            const isPending = call.status === 'pending';
            const isAcknowledged = call.status === 'acknowledged';
            const isActive = isPending || isAcknowledged;

            return (
              <div
                key={call.id}
                className={`
                border rounded-lg p-3 sm:p-4 transition-all bg-white
                ${isPending && isEmergency ? 'ring-2 ring-red-500 animate-pulse' : ''}
                ${!isActive ? 'opacity-60' : ''}
              `}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${getCallTypeColor(callType)}`}
                      >
                        {getCallTypeIcon(callType)}
                        <span>{getCallTypeLabel(callType)}</span>
                      </span>
                      <span className="text-base sm:text-lg font-semibold">
                        {call.table?.table_number ? `#${call.table.table_number}` : '—'}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-500">
                        {formatTimeAgo(call.created_at)}
                      </span>
                      {isAcknowledged && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          <Clock className="h-3 w-3" />
                          {t('calls.acknowledged')}
                        </span>
                      )}
                    </div>

                    {call.notes && (
                      <div className="mb-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs sm:text-sm text-gray-700">{call.notes}</p>
                      </div>
                    )}

                    {call.resolved_at && (
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                        <span>
                          {t('calls.resolved')} {formatTimeAgo(call.resolved_at)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    {isPending && (
                      <Button
                        onClick={() => handleAcknowledge(call.id)}
                        size="sm"
                        variant="outline"
                        className="flex-1 sm:flex-none"
                      >
                        <Bell className="h-4 w-4 mr-1" />
                        {t('calls.acknowledge')}
                      </Button>
                    )}
                    {isActive && (
                      <Button
                        onClick={() => handleResolve(call.id)}
                        size="sm"
                        className="flex-1 sm:flex-none"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {t('calls.resolve')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          },
        )}

        {filteredCalls?.length === 0 && (
          <div className="text-center py-8 sm:py-12 text-gray-500">
            <Bell className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm sm:text-base">{t('calls.noCalls')}</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">{t('calls.noCallsDescription')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
