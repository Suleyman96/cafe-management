import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import { WaiterCallCard } from '@/components/calls/WaiterCallCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import { useUpdateWaiterCall, useWaiterCalls } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import type { WaiterCall } from '@/types';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'acknowledged', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
];

export default function WaiterCallsScreen() {
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();
  const [statusFilter, setStatusFilter] = useState<WaiterCall['status']>('pending');

  const { data: calls, isLoading, error, refetch } = useWaiterCalls(statusFilter);
  const updateCall = useUpdateWaiterCall();

  const handleAcknowledge = async (callId: string) => {
    try {
      await updateCall.mutateAsync({ callId, status: 'acknowledged', staffId: staff?.id });
      showSuccess('Call acknowledged');
    } catch (err: any) {
      showError(err?.message || 'Failed to acknowledge');
    }
  };

  const handleResolve = async (callId: string) => {
    try {
      await updateCall.mutateAsync({ callId, status: 'resolved' });
      showSuccess('Call resolved');
    } catch (err: any) {
      showError(err?.message || 'Failed to resolve');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading calls..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={statusFilter}
        onValueChange={(v) => setStatusFilter(v as WaiterCall['status'])}
        buttons={STATUS_OPTIONS}
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
            title={`No ${statusFilter} calls`}
            description={
              statusFilter === 'pending' ? 'No customers need assistance right now' : undefined
            }
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
