import { useTranslation } from '@gustri/i18n';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { WaiterCallCard } from '@/components/calls/WaiterCallCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useUpdateWaiterCall, useWaiterCalls } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import type { WaiterCall } from '@/types';

export default function WaiterCallsScreen() {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [statusFilter, setStatusFilter] = useState<WaiterCall['status']>('pending');

  const { data: calls, isLoading, error, refetch } = useWaiterCalls(statusFilter);
  const updateCall = useUpdateWaiterCall();

  const statusOptions = useMemo(
    () => [
      { value: 'pending', label: tCommon('pending') },
      { value: 'acknowledged', label: tCommon('active') },
      { value: 'resolved', label: t('calls.resolved') },
    ],
    [t, tCommon],
  );

  const handleAcknowledge = async (callId: string) => {
    try {
      await updateCall.mutateAsync({ callId, status: 'acknowledged', staffId: staff?.id });
      showSuccess(t('calls.callAcknowledged'));
    } catch (err: any) {
      showError(err?.message || t('calls.failedAcknowledge'));
    }
  };

  const handleResolve = async (callId: string) => {
    try {
      await updateCall.mutateAsync({ callId, status: 'resolved' });
      showSuccess(t('calls.callResolved'));
    } catch (err: any) {
      showError(err?.message || t('calls.failedResolve'));
    }
  };

  if (isLoading) return <LoadingScreen message={t('calls.loadingCalls')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as WaiterCall['status'])}
        buttons={statusOptions}
        style={styles.tabs}
      />

      <FlatList
        data={calls || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <WaiterCallCard call={item} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="bell-off"
            title={t('calls.noCalls')}
            description={statusFilter === 'pending' ? t('calls.noCallsDescription') : undefined}
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
