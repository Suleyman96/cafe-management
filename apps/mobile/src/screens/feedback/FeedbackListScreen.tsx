import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useAcknowledgeFeedback,
  useDismissFeedback,
  useFeedback,
  useRespondToFeedback,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'acknowledged', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default function FeedbackListScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data: feedbackList, isLoading, error, refetch } = useFeedback(statusFilter || undefined);
  const acknowledgeFeedback = useAcknowledgeFeedback();
  const respondToFeedback = useRespondToFeedback();
  const dismissFeedback = useDismissFeedback();

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeFeedback.mutateAsync({ id, staffId: staff?.id || '' });
      showSuccess('Feedback acknowledged');
    } catch (err: any) {
      showError(err?.message || 'Failed to acknowledge');
    }
  };

  const handleRespond = async (id: string, response: string) => {
    try {
      await respondToFeedback.mutateAsync({
        id,
        staffId: staff?.id || '',
        response,
        status: 'resolved',
      });
      showSuccess('Response sent');
    } catch (err: any) {
      showError(err?.message || 'Failed to respond');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissFeedback.mutateAsync(id);
      showSuccess('Feedback dismissed');
    } catch (err: any) {
      showError(err?.message || 'Failed to dismiss');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading feedback..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={statusFilter}
        onValueChange={setStatusFilter}
        buttons={STATUS_OPTIONS}
        style={styles.tabs}
        density="small"
      />

      <FlatList
        data={feedbackList || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <FeedbackCard
            feedback={item}
            onAcknowledge={handleAcknowledge}
            onRespond={handleRespond}
            onDismiss={handleDismiss}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="message-off"
            title={`No ${statusFilter || ''} feedback`}
            description="Customer feedback will appear here"
          />
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabs: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  list: {
    paddingTop: 4,
    paddingBottom: 24,
  },
});
