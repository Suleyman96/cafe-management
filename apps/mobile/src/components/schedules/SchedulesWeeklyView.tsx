import type { StaffSchedule } from '@gustri/database/types';
import { useLocale, useTranslation } from '@gustri/i18n';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, CARD_RADIUS, COLORS } from '@/theme';

// The schedules hook joins staff data via Supabase select
type ScheduleWithStaff = StaffSchedule & {
  staff?: { full_name: string; role?: string } | null;
};

function formatTime(time: string) {
  return time?.slice(0, 5) || '';
}

const STATUS_DOT_COLOR: Record<string, string> = {
  scheduled: COLORS.textLight,
  in_progress: BRAND_PRIMARY,
  completed: COLORS.success,
  missed: COLORS.danger,
};

interface SchedulesWeeklyViewProps {
  weekDates: Date[];
  weeklyByDate: Record<string, ScheduleWithStaff[]>;
  isToday: (d: Date) => boolean;
  formatDateKey: (d: Date) => string;
  refetch: () => void;
  onEdit: (id: string) => void;
}

export function SchedulesWeeklyView({
  weekDates,
  weeklyByDate,
  isToday,
  formatDateKey,
  refetch,
  onEdit,
}: SchedulesWeeklyViewProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const locale = useLocale();

  return (
    <ScrollView
      contentContainerStyle={styles.weeklyContent}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
    >
      {weekDates.map((d) => {
        const dateKey = formatDateKey(d);
        const daySchedules = weeklyByDate[dateKey] || [];
        const isTodayDay = isToday(d);
        return (
          <View key={dateKey} style={[styles.weeklyDay, isTodayDay && styles.weeklyDayToday]}>
            <View style={styles.weeklyDayHeader}>
              <Text
                variant="titleSmall"
                style={[styles.weeklyDayLabel, isTodayDay && styles.weeklyDayLabelToday]}
              >
                {d.toLocaleDateString(locale, {
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
                  onPress={() => onEdit(sched.id)}
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
  );
}

const styles = StyleSheet.create({
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
});
