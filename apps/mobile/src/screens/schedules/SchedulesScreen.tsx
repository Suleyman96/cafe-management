import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Button, Chip, FAB, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { ScheduleCard } from '@/components/schedules/ScheduleCard';
import { EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useCreateSchedule,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
  useSchedulesByDate,
  useStaff,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';

export default function SchedulesScreen() {
  const { showSuccess, showError } = useSnackbar();
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: schedules, isLoading, error, refetch } = useSchedulesByDate(selectedDate);
  const { data: staffList } = useStaff();
  const createSchedule = useCreateSchedule();
  const markInProgress = useMarkScheduleInProgress();
  const markCompleted = useMarkScheduleCompleted();

  const [newSchedule, setNewSchedule] = useState({
    staff_id: '',
    planned_start: '09:00',
    planned_end: '17:00',
    notes: '',
  });

  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleCreate = async () => {
    if (!newSchedule.staff_id) {
      showError('Select a staff member');
      return;
    }
    try {
      await createSchedule.mutateAsync({
        staff_id: newSchedule.staff_id,
        planned_start: `${selectedDate}T${newSchedule.planned_start}:00`,
        planned_end: `${selectedDate}T${newSchedule.planned_end}:00`,
        notes: newSchedule.notes || undefined,
      });
      showSuccess('Schedule created');
      setShowCreateModal(false);
      setNewSchedule({ staff_id: '', planned_start: '09:00', planned_end: '17:00', notes: '' });
    } catch (err: any) {
      showError(err?.message || 'Failed to create schedule');
    }
  };

  const handleMarkInProgress = async (id: string) => {
    try {
      await markInProgress.mutateAsync({ id, actualStart: new Date().toISOString() });
      showSuccess('Shift started');
    } catch (err: any) {
      showError(err?.message || 'Failed to start shift');
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await markCompleted.mutateAsync({ id, actualEnd: new Date().toISOString() });
      showSuccess('Shift completed');
    } catch (err: any) {
      showError(err?.message || 'Failed to complete shift');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading schedules..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  const dateObj = new Date(`${selectedDate}T00:00:00`);
  const isToday = selectedDate === today;

  return (
    <View style={styles.container}>
      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <Button compact onPress={() => navigateDate(-1)}>
          Prev
        </Button>
        <View style={styles.dateCenter}>
          <Text variant="titleMedium" style={styles.dateLabel}>
            {dateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
          {!isToday && (
            <Button compact onPress={() => setSelectedDate(today)}>
              Today
            </Button>
          )}
        </View>
        <Button compact onPress={() => navigateDate(1)}>
          Next
        </Button>
      </View>

      <FlatList
        data={schedules || []}
        keyExtractor={(item: any) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <ScheduleCard
            schedule={item}
            onMarkInProgress={handleMarkInProgress}
            onMarkCompleted={handleMarkCompleted}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-blank"
            title="No schedules"
            description="No shifts scheduled for this day"
          />
        }
        contentContainerStyle={styles.list}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setShowCreateModal(true)} />

      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => setShowCreateModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 12 }}>
            New Schedule
          </Text>
          <Text variant="bodySmall" style={styles.muted}>
            Staff Member
          </Text>
          <View style={styles.chipRow}>
            {(staffList as any[])
              ?.filter((s: any) => s.is_active !== false)
              .map((s: any) => (
                <Chip
                  key={s.id}
                  compact
                  selected={newSchedule.staff_id === s.id}
                  onPress={() => setNewSchedule({ ...newSchedule, staff_id: s.id })}
                >
                  {s.full_name}
                </Chip>
              ))}
          </View>
          <TextInput
            label="Start Time (HH:MM)"
            value={newSchedule.planned_start}
            onChangeText={(v) => setNewSchedule({ ...newSchedule, planned_start: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="End Time (HH:MM)"
            value={newSchedule.planned_end}
            onChangeText={(v) => setNewSchedule({ ...newSchedule, planned_end: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Notes (optional)"
            value={newSchedule.notes}
            onChangeText={(v) => setNewSchedule({ ...newSchedule, notes: v })}
            mode="outlined"
            dense
            multiline
            style={styles.input}
          />
          <View style={styles.modalActions}>
            <Button onPress={() => setShowCreateModal(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleCreate} loading={createSchedule.isPending}>
              Create
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  dateNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { fontWeight: '600' },
  list: { paddingTop: 4, paddingBottom: 80 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  modal: { backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 12, maxHeight: '80%' },
  input: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  muted: { color: '#6b7280', marginBottom: 4 },
});
