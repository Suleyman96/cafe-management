import { useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Card, Chip, FAB, SegmentedButtons, Text } from 'react-native-paper';
import { ScheduleCard } from '@/components/schedules/ScheduleCard';
import { ScheduleModal } from '@/components/schedules/ScheduleModal';
import { ConfirmDialog, EmptyState, ErrorScreen, LoadingScreen } from '@/components/ui';
import {
  useCreateSchedule,
  useDeleteSchedule,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
  useSchedulesByDateRange,
  useStaff,
  useUpdateSchedule,
} from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';

function getWeekDates(referenceDate: Date) {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday first
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

const STATUS_DOT_COLOR: Record<string, string> = {
  scheduled: '#9ca3af',
  in_progress: '#3b82f6',
  completed: '#10b981',
  missed: '#ef4444',
};

export default function SchedulesScreen() {
  const { showSuccess, showError } = useSnackbar();
  const todayStr = formatDate(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('daily');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<any>(null);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);

  const weekDates = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    return getWeekDates(ref);
  }, [weekOffset]);

  const startDate = formatDate(weekDates[0]);
  const endDate = formatDate(weekDates[6]);

  const {
    data: schedules,
    isLoading,
    error,
    refetch,
  } = useSchedulesByDateRange(startDate, endDate);
  const { data: staffList } = useStaff();

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteScheduleMut = useDeleteSchedule();
  const markInProgress = useMarkScheduleInProgress();
  const markCompleted = useMarkScheduleCompleted();

  // Daily view: schedules for selected date
  const dailySchedules = useMemo(() => {
    if (!schedules) return [];
    return (schedules as any[]).filter((s) => s.date === selectedDate);
  }, [schedules, selectedDate]);

  // Weekly view: group schedules by date
  const weeklyByDate = useMemo(() => {
    if (!schedules) return {};
    const map: Record<string, any[]> = {};
    for (const sched of schedules as any[]) {
      if (!map[sched.date]) map[sched.date] = [];
      map[sched.date].push(sched);
    }
    return map;
  }, [schedules]);

  // Summary counts for the week
  const weekSummary = useMemo(() => {
    if (!schedules) return { total: 0, completed: 0, inProgress: 0 };
    const arr = schedules as any[];
    return {
      total: arr.length,
      completed: arr.filter((s) => s.status === 'completed').length,
      inProgress: arr.filter((s) => s.status === 'in_progress').length,
    };
  }, [schedules]);

  const handleMarkInProgress = async (id: string) => {
    try {
      await markInProgress.mutateAsync({ id, actualStart: new Date().toISOString() });
      showSuccess('Shift started');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to start shift');
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await markCompleted.mutateAsync({ id, actualEnd: new Date().toISOString() });
      showSuccess('Shift completed');
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to complete shift');
    }
  };

  const handleEdit = (id: string) => {
    const sched = (schedules as any[])?.find((s) => s.id === id);
    if (sched) {
      setEditSchedule(sched);
      setShowModal(true);
    }
  };

  const handleModalSubmit = async (payload: any) => {
    try {
      if (payload.mode === 'edit') {
        await updateSchedule.mutateAsync({ id: payload.id, data: payload.data });
        showSuccess('Schedule updated');
      } else if (payload.mode === 'bulk') {
        await Promise.allSettled(
          payload.entries.map((entry: any) => createSchedule.mutateAsync(entry)),
        );
        showSuccess(`Created ${payload.entries.length} schedules`);
      } else {
        await createSchedule.mutateAsync(payload.data);
        showSuccess('Schedule created');
      }
      setShowModal(false);
      setEditSchedule(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to save schedule');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleId) return;
    try {
      await deleteScheduleMut.mutateAsync(deleteScheduleId);
      showSuccess('Schedule deleted');
      setDeleteScheduleId(null);
      setShowModal(false);
      setEditSchedule(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading schedules..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  const isToday = (d: Date) => formatDate(d) === todayStr;

  return (
    <View style={styles.container}>
      {/* View Mode Toggle */}
      <View style={styles.header}>
        <SegmentedButtons
          value={viewMode}
          onValueChange={setViewMode}
          buttons={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
          ]}
          style={styles.segmented}
        />
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNav}>
        <Button compact onPress={() => setWeekOffset((p) => p - 1)}>
          Prev
        </Button>
        <View style={styles.weekCenter}>
          <Text variant="titleSmall" style={styles.weekLabel}>
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          {weekOffset !== 0 && (
            <Button compact onPress={() => setWeekOffset(0)}>
              This Week
            </Button>
          )}
        </View>
        <Button compact onPress={() => setWeekOffset((p) => p + 1)}>
          Next
        </Button>
      </View>

      {/* Week Summary Cards */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Total
            </Text>
            <Text variant="titleMedium" style={styles.summaryTotal}>
              {weekSummary.total}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              In Progress
            </Text>
            <Text variant="titleMedium" style={styles.summaryInProgress}>
              {weekSummary.inProgress}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              Completed
            </Text>
            <Text variant="titleMedium" style={styles.summaryCompleted}>
              {weekSummary.completed}
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* ===== DAILY VIEW ===== */}
      {viewMode === 'daily' && (
        <>
          {/* Day picker strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayPicker}
          >
            {weekDates.map((d) => {
              const dateKey = formatDate(d);
              const isSelected = selectedDate === dateKey;
              const dayCount = (weeklyByDate[dateKey] || []).length;
              return (
                <TouchableOpacity
                  key={dateKey}
                  onPress={() => setSelectedDate(dateKey)}
                  style={[
                    styles.dayBtn,
                    isSelected && styles.dayBtnSelected,
                    isToday(d) && !isSelected && styles.dayBtnToday,
                  ]}
                >
                  <Text style={[styles.dayWeekday, isSelected && styles.dayTextSelected]}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text
                    variant="titleSmall"
                    style={[styles.dayNumber, isSelected && styles.dayTextSelected]}
                  >
                    {d.getDate()}
                  </Text>
                  {dayCount > 0 && (
                    <View style={[styles.dayDot, isSelected && styles.dayDotSelected]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Daily count */}
          <Text variant="bodySmall" style={styles.countText}>
            {dailySchedules.length} schedule{dailySchedules.length !== 1 ? 's' : ''} ·{' '}
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          <FlatList
            data={dailySchedules}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
            renderItem={({ item }) => (
              <ScheduleCard
                schedule={item}
                onMarkInProgress={handleMarkInProgress}
                onMarkCompleted={handleMarkCompleted}
                onEdit={handleEdit}
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
        </>
      )}

      {/* ===== WEEKLY VIEW ===== */}
      {viewMode === 'weekly' && (
        <ScrollView
          contentContainerStyle={styles.weeklyContent}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        >
          {weekDates.map((d) => {
            const dateKey = formatDate(d);
            const daySchedules = weeklyByDate[dateKey] || [];
            const isTodayDay = isToday(d);
            return (
              <View key={dateKey} style={[styles.weeklyDay, isTodayDay && styles.weeklyDayToday]}>
                <View style={styles.weeklyDayHeader}>
                  <Text
                    variant="titleSmall"
                    style={[styles.weeklyDayLabel, isTodayDay && styles.weeklyDayLabelToday]}
                  >
                    {d.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Chip compact style={styles.countChip} textStyle={styles.countChipText}>
                    {daySchedules.length}
                  </Chip>
                </View>
                {daySchedules.length === 0 ? (
                  <Text variant="bodySmall" style={styles.noShifts}>
                    No shifts
                  </Text>
                ) : (
                  daySchedules.map((sched: any) => (
                    <TouchableOpacity
                      key={sched.id}
                      onPress={() => handleEdit(sched.id)}
                      style={styles.weeklyBlock}
                    >
                      <View
                        style={[
                          styles.weeklyDot,
                          { backgroundColor: STATUS_DOT_COLOR[sched.status] || '#9ca3af' },
                        ]}
                      />
                      <View style={styles.weeklyBlockInfo}>
                        <Text variant="bodySmall" style={styles.weeklyStaff} numberOfLines={1}>
                          {sched.staff?.full_name || 'Unknown'}
                        </Text>
                        <Text variant="bodySmall" style={styles.weeklyTime}>
                          {formatTime(sched.planned_start)} – {formatTime(sched.planned_end)}
                        </Text>
                      </View>
                      <Text
                        variant="bodySmall"
                        style={[
                          styles.weeklyStatus,
                          { color: STATUS_DOT_COLOR[sched.status] || '#9ca3af' },
                        ]}
                      >
                        {sched.status.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <FAB
        icon="plus"
        label="Add Schedule"
        style={styles.fab}
        onPress={() => {
          setEditSchedule(null);
          setShowModal(true);
        }}
      />

      <ScheduleModal
        visible={showModal}
        onDismiss={() => {
          setShowModal(false);
          setEditSchedule(null);
        }}
        onSubmit={handleModalSubmit}
        onDelete={(id) => setDeleteScheduleId(id)}
        loading={createSchedule.isPending || updateSchedule.isPending}
        initialData={editSchedule}
        staffList={staffList || []}
        defaultDate={selectedDate}
      />

      <ConfirmDialog
        visible={!!deleteScheduleId}
        title="Delete Schedule"
        message="Are you sure you want to delete this schedule?"
        onConfirm={handleDeleteSchedule}
        onCancel={() => setDeleteScheduleId(null)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 16, paddingTop: 8 },
  segmented: { marginBottom: 4 },
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  weekCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weekLabel: { fontWeight: '600' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  summaryCard: { flex: 1 },
  summaryTotal: { fontWeight: '700', color: '#1e293b' },
  summaryInProgress: { fontWeight: '700', color: '#3b82f6' },
  summaryCompleted: { fontWeight: '700', color: '#10b981' },
  muted: { color: '#6b7280' },
  // Day picker
  dayPicker: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  dayBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 52,
  },
  dayBtnSelected: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  dayBtnToday: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  dayWeekday: { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  dayNumber: { fontWeight: '700', color: '#1e293b' },
  dayTextSelected: { color: '#fff' },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#3b82f6', marginTop: 3 },
  dayDotSelected: { backgroundColor: '#fff' },
  countText: { color: '#9ca3af', paddingHorizontal: 16, marginBottom: 4 },
  list: { paddingTop: 4, paddingBottom: 80 },
  // Weekly view
  weeklyContent: { paddingHorizontal: 16, paddingBottom: 80 },
  weeklyDay: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  weeklyDayToday: { borderColor: '#93c5fd', backgroundColor: '#fafbff' },
  weeklyDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weeklyDayLabel: { fontWeight: '600', color: '#374151' },
  weeklyDayLabelToday: { color: '#3b82f6' },
  countChip: { backgroundColor: '#f3f4f6' },
  countChipText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  noShifts: { color: '#d1d5db', fontStyle: 'italic' },
  weeklyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  weeklyDot: { width: 8, height: 8, borderRadius: 4 },
  weeklyBlockInfo: { flex: 1 },
  weeklyStaff: { fontWeight: '600', color: '#1e293b', fontSize: 13 },
  weeklyTime: { color: '#6b7280', fontSize: 12 },
  weeklyStatus: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
