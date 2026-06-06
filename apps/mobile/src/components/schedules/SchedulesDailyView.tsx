import type { StaffSchedule } from '@gustri/database/types';
import { useLocale, useTranslation } from '@gustri/i18n';
import { EmptyState } from '@gustri/ui-mobile';
import { FlashList } from '@shopify/flash-list';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ScheduleCard } from '@/components/schedules/ScheduleCard';
import { Text } from '@/lib/paper-compat';
import { BRAND_PRIMARY, COLORS } from '@/theme';

// The schedules hook joins staff data via Supabase select
type ScheduleWithStaff = StaffSchedule & {
  staff?: { full_name: string; role?: string } | null;
};

interface SchedulesDailyViewProps {
  weekDates: Date[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  weeklyByDate: Record<string, ScheduleWithStaff[]>;
  dailySchedules: ScheduleWithStaff[];
  isToday: (d: Date) => boolean;
  formatDateKey: (d: Date) => string;
  refetch: () => void;
  onMarkInProgress: (id: string) => void;
  onMarkCompleted: (id: string) => void;
  onEdit: (id: string) => void;
}

export function SchedulesDailyView({
  weekDates,
  selectedDate,
  setSelectedDate,
  weeklyByDate,
  dailySchedules,
  isToday,
  formatDateKey,
  refetch,
  onMarkInProgress,
  onMarkCompleted,
  onEdit,
}: SchedulesDailyViewProps) {
  const { t } = useTranslation('staff');
  const locale = useLocale();

  return (
    <>
      {/* Day picker strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayPicker}
      >
        {weekDates.map((d) => {
          const dateKey = formatDateKey(d);
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
                {d.toLocaleDateString(locale, { weekday: 'short' })}
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
        {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(locale, {
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
            onMarkInProgress={onMarkInProgress}
            onMarkCompleted={onMarkCompleted}
            onEdit={onEdit}
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
  );
}

const styles = StyleSheet.create({
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
});
