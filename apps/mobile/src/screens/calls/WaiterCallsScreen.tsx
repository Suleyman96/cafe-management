import { useTranslation } from '@gustri/i18n';
import { EmptyState, ErrorScreen, LoadingScreen } from '@gustri/ui-mobile';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { WaiterCallCard } from '@/components/calls/WaiterCallCard';
import { useUpdateWaiterCall, useWaiterCalls } from '@/hooks/local';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import type { WaiterCall } from '@/types';

/**
 * No FAB on this screen — waiter calls are created by *customers* from
 * customer-web (the "call staff" CTA in the table session), not by staff.
 * A "+" FAB here would invite the wrong action.
 */
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

  // Stable identities so React.memo on WaiterCallCard actually skips
  // re-renders. Recreated only when their dependencies change — typing the
  // dep list here is the correctness anchor: forget one and an unrelated
  // realtime tick re-renders every card on screen.
  const handleAcknowledge = useCallback(
    async (callId: string) => {
      try {
        await updateCall.mutateAsync({ callId, status: 'acknowledged', staffId: staff?.id });
        showSuccess(t('calls.callAcknowledged'));
      } catch (err: unknown) {
        showError(err instanceof Error ? err : t('calls.failedAcknowledge'));
      }
    },
    [updateCall, staff?.id, showSuccess, showError, t],
  );

  const handleResolve = useCallback(
    async (callId: string) => {
      try {
        await updateCall.mutateAsync({ callId, status: 'resolved' });
        showSuccess(t('calls.callResolved'));
      } catch (err: unknown) {
        showError(err instanceof Error ? err : t('calls.failedResolve'));
      }
    },
    [updateCall, showSuccess, showError, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: WaiterCall }) => (
      <WaiterCallCard call={item} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
    ),
    [handleAcknowledge, handleResolve],
  );

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

      <FlashList
        data={calls || []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={renderItem}
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
