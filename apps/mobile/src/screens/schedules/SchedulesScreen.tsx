import { getLocalDateString, getWeekDates } from '@gustri/core';
import type { StaffSchedule } from '@gustri/database/types';
import { useLocale, useTranslation } from '@gustri/i18n';
import { ConfirmDialog, ErrorScreen, LoadingScreen } from '@gustri/ui-mobile';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, FAB, SegmentedButtons } from 'react-native-paper';
import { ScheduleModal } from '@/components/schedules/ScheduleModal';
import { SchedulesDailyView } from '@/components/schedules/SchedulesDailyView';
import { SchedulesWeeklyView } from '@/components/schedules/SchedulesWeeklyView';
import { useSchedulesByDateRange, useStaff } from '@/hooks/shared';
import { Text } from '@/lib/paper-compat';
import { useScheduleActions } from '@/screens/schedules/useScheduleActions';
import { BRAND_PRIMARY, COLORS } from '@/theme';

// The schedules hook joins staff data via Supabase select
type ScheduleWithStaff = StaffSchedule & {
  staff?: { full_name: string; role?: string } | null;
};

function formatDate(d: Date) {
  return getLocalDateString(d);
}

export default function SchedulesScreen() {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const locale = useLocale();
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

  const {
    createSchedule,
    updateSchedule,
    handleMarkInProgress,
    handleMarkCompleted,
    handleEdit,
    handleModalSubmit,
    handleDeleteSchedule,
  } = useScheduleActions({
    schedules,
    deleteScheduleId,
    setShowModal,
    setEditSchedule,
    setDeleteScheduleId,
  });

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
            {weekDates[0].toLocaleDateString(locale, { month: 'short', day: 'numeric' })} –{' '}
            {weekDates[6].toLocaleDateString(locale, {
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
        <SchedulesDailyView
          weekDates={weekDates}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          weeklyByDate={weeklyByDate}
          dailySchedules={dailySchedules}
          isToday={isToday}
          formatDateKey={formatDate}
          refetch={refetch}
          onMarkInProgress={handleMarkInProgress}
          onMarkCompleted={handleMarkCompleted}
          onEdit={handleEdit}
        />
      )}

      {/* ===== WEEKLY VIEW ===== */}
      {viewMode === 'weekly' && (
        <SchedulesWeeklyView
          weekDates={weekDates}
          weeklyByDate={weeklyByDate}
          isToday={isToday}
          formatDateKey={formatDate}
          refetch={refetch}
          onEdit={handleEdit}
        />
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
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
