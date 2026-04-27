import type { StaffSchedule, StaffScheduleInsert } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';

// The schedules hook joins staff data via Supabase select
type ScheduleWithStaff = StaffSchedule & {
  staff?: { full_name: string; role?: string } | null;
};

import { getLocalDateString } from '@gustri/core';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Chip, FAB, SegmentedButtons } from 'react-native-paper';
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
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, CARD_RADIUS, COLORS } from '@/theme';

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
  return getLocalDateString(d);
}

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

const STATUS_DOT_COLOR: Record<string, string> = {
  scheduled: COLORS.textLight,
  in_progress: BRAND_PRIMARY,
  completed: COLORS.success,
  missed: COLORS.danger,
};

export default function SchedulesScreen() {
  const { showSuccess, showError } = useSnackbar();
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const todayStr = formatDate(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('daily');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editSchedule, setEditSchedule] = useState<{
    id: string;
    staff_id?: string;
    date?: string;
    planned_start?: string;
    planned_end?: string;
    actual_start?: string | null;
    actual_end?: string | null;
    status?: string;
    notes?: string | null;
  } | null>(null);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);

  const weekDates = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + weekOffset * 7);
    return getWeekDates(ref);
  }, [weekOffset]);

  const startDate = formatDate(weekDates[0]);
  const endDate = formatDate(weekDates[6]);

  const {
    data: rawSchedules,
    isLoading,
    error,
    refetch,
  } = useSchedulesByDateRange(startDate, endDate);
  // The hook joins staff data via Supabase select but the return type doesn't reflect it
  const schedules = rawSchedules as ScheduleWithStaff[] | undefined;
  const { data: staffList } = useStaff();

  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteScheduleMut = useDeleteSchedule();
  const markInProgress = useMarkScheduleInProgress();
  const markCompleted = useMarkScheduleCompleted();

  // Daily view: schedules for selected date
  const dailySchedules = useMemo(() => {
    if (!schedules) return [];
    return schedules.filter((s) => s.date === selectedDate);
  }, [schedules, selectedDate]);

  // Weekly view: group schedules by date
  const weeklyByDate = useMemo(() => {
    if (!schedules) return {};
    const map: Record<string, ScheduleWithStaff[]> = {};
    for (const sched of schedules) {
      if (!map[sched.date]) map[sched.date] = [];
      map[sched.date].push(sched);
    }
    return map;
  }, [schedules]);

  // Summary counts for the week
  const weekSummary = useMemo(() => {
    if (!schedules) return { total: 0, completed: 0, inProgress: 0 };
    const arr = schedules;
    return {
      total: arr.length,
      completed: arr.filter((s) => s.status === 'completed').length,
      inProgress: arr.filter((s) => s.status === 'in_progress').length,
    };
  }, [schedules]);

  const handleMarkInProgress = async (id: string) => {
    try {
      await markInProgress.mutateAsync({ id, actualStart: new Date().toISOString() });
      showSuccess(t('schedules.shiftStarted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('schedules.failedStartShift'));
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await markCompleted.mutateAsync({ id, actualEnd: new Date().toISOString() });
      showSuccess(t('schedules.shiftCompleted'));
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('schedules.failedCompleteShift'));
    }
  };

  const handleEdit = (id: string) => {
    const sched = schedules?.find((s) => s.id === id);
    if (sched) {
      setEditSchedule(sched);
      setShowModal(true);
    }
  };

  const handleModalSubmit = async (payload: {
    id?: string;
    data?: Record<string, string | number | boolean | null>;
    entries?: Record<string, string | number | boolean | null>[];
    mode: 'edit' | 'create' | 'bulk';
  }) => {
    try {
      if (payload.mode === 'edit') {
        await updateSchedule.mutateAsync({ id: payload.id!, data: payload.data! });
        showSuccess(t('schedules.scheduleUpdated'));
      } else if (payload.mode === 'bulk') {
        const results = await Promise.allSettled(
          (payload.entries || []).map((entry) =>
            createSchedule.mutateAsync(entry as unknown as StaffScheduleInsert),
          ),
        );
        const successCount = results.filter((r) => r.status === 'fulfilled').length;
        const failCount = results.length - successCount;
        if (failCount > 0) {
          showError(t('schedules.bulkCreatePartial', { successCount, failCount }));
        } else {
          showSuccess(t('schedules.bulkCreateSuccess', { count: successCount }));
        }
      } else {
        await createSchedule.mutateAsync(payload.data as unknown as StaffScheduleInsert);
        showSuccess(t('schedules.scheduleCreated'));
      }
      setShowModal(false);
      setEditSchedule(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('schedules.failedSave'));
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleId) return;
    try {
      await deleteScheduleMut.mutateAsync(deleteScheduleId);
      showSuccess(t('schedules.scheduleDeleted'));
      setDeleteScheduleId(null);
      setShowModal(false);
      setEditSchedule(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('schedules.failedDelete'));
    }
  };

  if (isLoading) return <LoadingScreen message={t('schedules.loadingSchedules')} />;
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
            { value: 'daily', label: t('schedules.week') },
            { value: 'weekly', label: t('schedules.list') },
          ]}
          style={styles.segmented}
        />
      </View>

      {/* Week Navigation */}
      <View style={styles.weekNav}>
        <Button compact onPress={() => setWeekOffset((p) => p - 1)}>
          {t('schedules.prev')}
        </Button>
        <View style={styles.weekCenter}>
          <Text variant="titleSmall" style={styles.weekLabel}>
            {weekDates[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString('default', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          {weekOffset !== 0 && (
            <Button compact onPress={() => setWeekOffset(0)}>
              {tCommon('thisWeek')}
            </Button>
          )}
        </View>
        <Button compact onPress={() => setWeekOffset((p) => p + 1)}>
          {t('schedules.next')}
        </Button>
      </View>

      {/* Week Summary Cards */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              {tCommon('total')}
            </Text>
            <Text variant="titleMedium" style={styles.summaryTotal}>
              {weekSummary.total}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              {t('schedules.inProgress')}
            </Text>
            <Text variant="titleMedium" style={styles.summaryInProgress}>
              {weekSummary.inProgress}
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text variant="bodySmall" style={styles.muted}>
              {tCommon('completed')}
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
                    {d.toLocaleDateString('default', { weekday: 'short' })}
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
            {t('schedules.scheduleCount', { count: dailySchedules.length })} ·{' '}
            {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('default', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>

          <FlashList
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
                title={t('schedules.noSchedules')}
                description={t('schedules.noSchedulesDescription')}
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
                    {d.toLocaleDateString('default', {
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
                    {t('schedules.noShifts')}
                  </Text>
                ) : (
                  daySchedules.map((sched) => (
                    <TouchableOpacity
                      key={sched.id}
                      onPress={() => handleEdit(sched.id)}
                      style={styles.weeklyBlock}
                    >
                      <View
                        style={[
                          styles.weeklyDot,
                          { backgroundColor: STATUS_DOT_COLOR[sched.status] || COLORS.textLight },
                        ]}
                      />
                      <View style={styles.weeklyBlockInfo}>
                        <Text variant="bodySmall" style={styles.weeklyStaff} numberOfLines={1}>
                          {sched.staff?.full_name || tCommon('unknown')}
                        </Text>
                        <Text variant="bodySmall" style={styles.weeklyTime}>
                          {formatTime(sched.planned_start)} – {formatTime(sched.planned_end)}
                        </Text>
                      </View>
                      <Text
                        variant="bodySmall"
                        style={[
                          styles.weeklyStatus,
                          { color: STATUS_DOT_COLOR[sched.status] || COLORS.textLight },
                        ]}
                      >
                        {t(`schedules.${sched.status}`)}
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
        label={t('schedules.addSchedule')}
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
        title={t('schedules.deleteSchedule')}
        message={t('schedules.deleteScheduleConfirm')}
        onConfirm={handleDeleteSchedule}
        onCancel={() => setDeleteScheduleId(null)}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
  summaryTotal: { fontWeight: '700', color: COLORS.textPrimary },
  summaryInProgress: { fontWeight: '700', color: BRAND_PRIMARY },
  summaryCompleted: { fontWeight: '700', color: COLORS.success },
  muted: { color: COLORS.textMuted },
  // Day picker
  dayPicker: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  dayBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 52,
  },
  dayBtnSelected: { backgroundColor: BRAND_PRIMARY, borderColor: BRAND_PRIMARY },
  dayBtnToday: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  dayWeekday: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500' },
  dayNumber: { fontWeight: '700', color: COLORS.textPrimary },
  dayTextSelected: { color: COLORS.card },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: BRAND_PRIMARY, marginTop: 3 },
  dayDotSelected: { backgroundColor: COLORS.card },
  countText: { color: COLORS.textLight, paddingHorizontal: 16, marginBottom: 4 },
  list: { paddingTop: 4, paddingBottom: 80 },
  // Weekly view
  weeklyContent: { paddingHorizontal: 16, paddingBottom: 80 },
  weeklyDay: {
    backgroundColor: COLORS.card,
    borderRadius: CARD_RADIUS,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  weeklyDayToday: { borderColor: '#93c5fd', backgroundColor: '#fafbff' },
  weeklyDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weeklyDayLabel: { fontWeight: '600', color: COLORS.textPrimary },
  weeklyDayLabelToday: { color: BRAND_PRIMARY },
  countChip: { backgroundColor: COLORS.borderLight },
  countChipText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  noShifts: { color: COLORS.border, fontStyle: 'italic' },
  weeklyBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  weeklyDot: { width: 8, height: 8, borderRadius: 4 },
  weeklyBlockInfo: { flex: 1 },
  weeklyStaff: { fontWeight: '600', color: COLORS.textPrimary, fontSize: 13 },
  weeklyTime: { color: COLORS.textMuted, fontSize: 12 },
  weeklyStatus: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
