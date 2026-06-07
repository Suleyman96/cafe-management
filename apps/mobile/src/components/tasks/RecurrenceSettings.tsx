import { WEEKDAY_TRANSLATION_KEY, WEEKDAYS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { Text, TextInput } from '@/lib/paper-compat';
import { TimePicker } from './TimePicker';

type RecurrencePattern = 'daily' | 'weekly' | 'monthly';

interface RecurrenceSettingsProps {
  recurrencePattern: RecurrencePattern;
  onRecurrencePatternChange: (pattern: RecurrencePattern) => void;
  recurrenceDays: number[];
  onRecurrenceDaysChange: (days: number[]) => void;
  toggleWeekday: (day: number) => void;
  dueTime: string;
  onDueTimeChange: (time: string) => void;
  showTimePicker: boolean;
  onToggleTimePicker: () => void;
}

export function RecurrenceSettings({
  recurrencePattern,
  onRecurrencePatternChange,
  recurrenceDays,
  onRecurrenceDaysChange,
  toggleWeekday,
  dueTime,
  onDueTimeChange,
  showTimePicker,
  onToggleTimePicker,
}: RecurrenceSettingsProps) {
  const { t } = useTranslation('staff');

  const PATTERNS = [
    { value: 'daily' as const, label: t('tasks.daily') },
    { value: 'weekly' as const, label: t('tasks.weekly') },
    { value: 'monthly' as const, label: t('tasks.monthly') },
  ];

  return (
    <View style={styles.recurringSection}>
      <Text variant="labelMedium" style={styles.recurringLabel}>
        {t('tasks.recurrencePattern')}
      </Text>
      <View style={styles.row}>
        {PATTERNS.map((p) => (
          <Chip
            key={p.value}
            selected={recurrencePattern === p.value}
            onPress={() => {
              onRecurrencePatternChange(p.value);
              onRecurrenceDaysChange([]);
            }}
            compact
            style={[
              styles.patternChip,
              recurrencePattern === p.value && { backgroundColor: '#dbeafe' },
            ]}
          >
            {p.label}
          </Chip>
        ))}
      </View>

      {/* Weekly: day buttons */}
      {recurrencePattern === 'weekly' && (
        <>
          <Text variant="labelSmall" style={styles.recurringSubLabel}>
            {t('tasks.whichDays')}
          </Text>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <Chip
                key={day.value}
                selected={recurrenceDays.includes(day.value)}
                onPress={() => toggleWeekday(day.value)}
                compact
                style={[
                  styles.weekdayChip,
                  recurrenceDays.includes(day.value) && { backgroundColor: '#dbeafe' },
                ]}
              >
                {/* WEEKDAY_TRANSLATION_KEY covers every WEEKDAYS value (1-7). */}
                {t(WEEKDAY_TRANSLATION_KEY[day.value]!)}
              </Chip>
            ))}
          </View>
        </>
      )}

      {/* Monthly: day of month */}
      {recurrencePattern === 'monthly' && (
        <>
          <Text variant="labelSmall" style={styles.recurringSubLabel}>
            {t('tasks.dayOfMonth')}
          </Text>
          <TextInput
            value={recurrenceDays[0]?.toString() || ''}
            onChangeText={(v: string) => {
              const num = Number.parseInt(v, 10);
              onRecurrenceDaysChange(num >= 1 && num <= 31 ? [num] : []);
            }}
            mode="outlined"
            dense
            keyboardType="number-pad"
            placeholder="1-31"
            style={[styles.input, { width: 100 }]}
          />
        </>
      )}

      {/* Default time for recurring */}
      <Text variant="labelSmall" style={styles.recurringSubLabel}>
        {t('tasks.defaultDueTime')}
      </Text>
      <TimePicker
        value={dueTime}
        onChange={onDueTimeChange}
        open={showTimePicker}
        onToggle={onToggleTimePicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  recurringSection: {
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 8,
  },
  recurringLabel: { color: '#1e40af', marginBottom: 8 },
  recurringSubLabel: { color: '#1e40af', marginTop: 8, marginBottom: 4 },
  patternChip: {},
  weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  weekdayChip: {},
});
