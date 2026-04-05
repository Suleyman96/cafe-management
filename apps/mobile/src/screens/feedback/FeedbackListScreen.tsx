import { useTranslation } from '@gustri/i18n';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useFeedback, useMarkFeedbackRead } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';

type FeedbackTab = 'pending' | 'acknowledged';

export default function FeedbackListScreen() {
  const { t } = useTranslation('staff');
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [selectedTab, setSelectedTab] = useState<FeedbackTab>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const TAB_OPTIONS = [
    { value: 'pending', label: t('feedback.unreadTab') },
    { value: 'acknowledged', label: t('feedback.readTab') },
  ];

  const { data: feedbackList, isLoading, error, refetch } = useFeedback(selectedTab);
  const markRead = useMarkFeedbackRead();

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (!staff?.id) return;
      setProcessingId(id);
      try {
        await markRead.mutateAsync({ id, staffId: staff.id });
        showSuccess(t('feedback.markedAsRead'));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : t('feedback.failedMarkRead');
        showError(message);
      } finally {
        setProcessingId(null);
      }
    },
    [staff?.id, markRead, showSuccess, showError, t],
  );

  if (isLoading) return <LoadingScreen message={t('feedback.loadingFeedback')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={selectedTab}
        onValueChange={(v) => setSelectedTab(v as FeedbackTab)}
        buttons={TAB_OPTIONS}
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
            onMarkRead={handleMarkRead}
            isProcessing={processingId === item.id}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="message-off"
            title={t('feedback.noFeedback')}
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
