'use client';

import { useState, useEffect } from 'react';
import { useWaiterCalls, useResolveWaiterCall } from '@/hooks';
import { LoadingSpinner, Button } from '@cafe-idare/ui';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Bell,
  AlertCircle,
  CheckCircle,
  MessageSquare,
  HelpCircle,
  DollarSign,
  Zap,
  RefreshCw
} from 'lucide-react';

export default function WaiterCallsPage() {
  const { data: waiterCalls, isLoading: loading, error, refetch } = useWaiterCalls();
  const respondToCall = useResolveWaiterCall();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');

  // Filter calls based on status
  const filteredCalls = waiterCalls?.filter((call: any) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return call.status === 'pending';
    return call.status === 'completed';
  });

  // Set up real-time subscription
  useEffect(() => {
    console.log('Setting up waiter-calls realtime subscription');
    const channel = supabase
      .channel('waiter-calls-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        () => {
          refetch();
        }
      )
      .subscribe((status) => {
        console.log('Waiter calls subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  // Get icon for reason
  const getReasonIcon = (reason: string) => {
    switch (reason) {
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

  // Get reason color
  const getReasonColor = (reason: string) => {
    switch (reason) {
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
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  // Handle respond to call
  const handleRespond = async (callId: string) => {
    try {
      await respondToCall.mutateAsync({ callId, notes: undefined });
      toast.success('Call marked as completed');
    } catch (error) {
      toast.error('Failed to respond to call');
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
        <p className="text-red-500">Error loading waiter calls</p>
      </div>
    );
  }

  const pendingCallsCount = waiterCalls?.filter((call: any) => call.status === 'pending').length || 0;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Waiter Calls</h1>
          {pendingCallsCount > 0 && (
            <p className="text-sm text-orange-600 font-medium">
              {pendingCallsCount} pending {pendingCallsCount === 1 ? 'call' : 'calls'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => refetch()}
            size="sm"
          >
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
          Pending
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
            filter === 'completed'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
            filter === 'all'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
      </div>

      {/* Calls List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredCalls?.map((call: any) => {
          const callType = call.call_type || call.reason || 'assistance';
          const isEmergency = callType === 'emergency';
          const isPending = call.status === 'pending';

          // Get display label for call type
          const getCallTypeLabel = (type: string) => {
            switch (type) {
              case 'bill': return 'Request Bill';
              case 'assistance': return 'Assistance';
              case 'complaint': return 'Complaint';
              case 'question': return 'Question';
              case 'emergency': return 'Emergency';
              default: return type.charAt(0).toUpperCase() + type.slice(1);
            }
          };

          return (
            <div
              key={call.id}
              className={`
                border rounded-lg p-3 sm:p-4 transition-all bg-white
                ${isPending && isEmergency ? 'ring-2 ring-red-500 animate-pulse' : ''}
                ${!isPending ? 'opacity-60' : ''}
              `}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                    <span className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${getReasonColor(callType)}`}>
                      {getReasonIcon(callType)}
                      <span>{getCallTypeLabel(callType)}</span>
                    </span>
                    <span className="text-base sm:text-lg font-semibold">
                      {call.table?.table_number}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-500">
                      {formatTimeAgo(call.created_at)}
                    </span>
                  </div>

                  {(call.reason || call.message) && (
                    <div className="mb-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-700">{call.reason || call.message}</p>
                    </div>
                  )}

                  {call.responded_at && call.staff && (
                    <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                      <span>Responded by {call.staff.name} at {formatTimeAgo(call.responded_at)}</span>
                    </div>
                  )}
                </div>

                {isPending && (
                  <Button
                    onClick={() => handleRespond(call.id)}
                    size="sm"
                    className="w-full sm:w-auto sm:ml-4"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Respond
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {filteredCalls?.length === 0 && (
          <div className="text-center py-8 sm:py-12 text-gray-500">
            <Bell className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm sm:text-base">No {filter !== 'all' ? filter : ''} calls</p>
          </div>
        )}
      </div>
    </div>
  );
}