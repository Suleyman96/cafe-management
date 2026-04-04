import { useTranslation } from '@gustri/i18n';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
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
import type { CustomerFeedback } from '@/types';

export default function FeedbackListScreen() {
  const { t } = useTranslation('staff');
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [statusFilter, setStatusFilter] = useState<CustomerFeedback['status'] | ''>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const STATUS_OPTIONS = [
    { value: '', label: t('feedback.allTab') },
    { value: 'pending', label: t('feedback.pendingTab') },
    { value: 'acknowledged', label: t('feedback.activeTab') },
    { value: 'resolved', label: t('feedback.resolvedTab') },
    { value: 'dismissed', label: t('feedback.dismissedTab') },
  ];

  const { data: feedbackList, isLoading, error, refetch } = useFeedback(statusFilter || undefined);
  const acknowledgeFeedback = useAcknowledgeFeedback();
  const respondToFeedback = useRespondToFeedback();
  const dismissFeedback = useDismissFeedback();

  const handleAcknowledge = useCallback(
    async (id: string) => {
      if (!staff?.id) return;
      setProcessingId(id);
      try {
        await acknowledgeFeedback.mutateAsync({ id, staffId: staff.id });
        showSuccess(t('feedback.feedbackAcknowledged'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('feedback.failedAcknowledge');
        showError(message);
      } finally {
        setProcessingId(null);
      }
    },
    [staff?.id, acknowledgeFeedback, showSuccess, showError, t],
  );

  const handleRespond = useCallback(
    async (id: string, response: string) => {
      if (!staff?.id) return;
      setProcessingId(id);
      try {
        await respondToFeedback.mutateAsync({
          id,
          staffId: staff.id,
          response,
          status: 'resolved',
        });
        showSuccess(t('feedback.responseSent'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('feedback.failedRespond');
        showError(message);
      } finally {
        setProcessingId(null);
      }
    },
    [staff?.id, respondToFeedback, showSuccess, showError, t],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      Alert.alert(t('feedback.dismiss'), t('feedback.dismissConfirm'), [
        { text: t('feedback.cancel'), style: 'cancel' },
        {
          text: t('feedback.dismiss'),
          style: 'destructive',
          onPress: async () => {
            setProcessingId(id);
            try {
              await dismissFeedback.mutateAsync(id);
              showSuccess(t('feedback.feedbackDismissed'));
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : t('feedback.failedDismiss');
              showError(message);
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]);
    },
    [dismissFeedback, showSuccess, showError, t],
  );

  if (isLoading) return <LoadingScreen message={t('feedback.loadingFeedback')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as CustomerFeedback['status'] | '')}
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
            isProcessing={processingId === item.id}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="message-off"
            title={
              statusFilter
                ? t('feedback.noStatusFeedback', {
                    status: t(`feedback.status.${statusFilter}`).toLowerCase(),
                  })
                : t('feedback.noAllFeedback')
            }
            description={t('feedback.feedbackAppearHere')}
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
