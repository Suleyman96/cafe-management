import { DAYS_OF_WEEK, TIME_OPTIONS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Modal, Portal, Switch, Text } from 'react-native-paper';
import { getLocalDateString } from '@/lib/date-utils';
import { TextInput } from '@/lib/paper-compat';
import { BRAND_PRIMARY } from '@/theme';

const STATUSES = ['scheduled', 'in_progress', 'completed', 'missed'] as const;
const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6b7280',
  in_progress: BRAND_PRIMARY,
  completed: '#10b981',
  missed: '#ef4444',
};

interface ScheduleModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: any) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
  initialData?: any;
  staffList: { id: string; full_name: string; role?: string; is_active?: boolean }[];
  defaultDate?: string;
}

export function ScheduleModal({
  visible,
  onDismiss,
  onSubmit,
  onDelete,
  loading,
  initialData,
  staffList,
  defaultDate,
}: ScheduleModalProps) {
  const isEdit = !!initialData;
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');

  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState('');
  const [plannedStart, setPlannedStart] = useState('09:00');
  const [plannedEnd, setPlannedEnd] = useState('17:00');
  const [actualStart, setActualStart] = useState('');
  const [actualEnd, setActualEnd] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [notes, setNotes] = useState('');

  // Bulk create state
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(1);

  useEffect(() => {
    if (!visible) return;
    if (initialData) {
      setStaffId(initialData.staff_id || '');
      setDate(initialData.date || '');
      setPlannedStart(initialData.planned_start?.slice(0, 5) || '09:00');
      setPlannedEnd(initialData.planned_end?.slice(0, 5) || '17:00');
      setStatus(initialData.status || 'scheduled');
      setNotes(initialData.notes || '');
      setActualStart(
        initialData.actual_start
          ? new Date(initialData.actual_start).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : '',
      );
      setActualEnd(
        initialData.actual_end
          ? new Date(initialData.actual_end).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
          : '',
      );
      setRepeatEnabled(false);
      setRepeatDays([]);
      setRepeatWeeks(1);
    } else {
      setStaffId('');
      setDate(defaultDate || getLocalDateString());
      setPlannedStart('09:00');
      setPlannedEnd('17:00');
      setActualStart('');
      setActualEnd('');
      setStatus('scheduled');
      setNotes('');
      setRepeatEnabled(false);
      setRepeatDays([]);
      setRepeatWeeks(1);
    }
  }, [visible, initialData, defaultDate]);

  const toggleRepeatDay = (day: number) => {
    setRepeatDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = () => {
    if (!staffId) return;

    if (isEdit) {
      const updateData: any = {
        staff_id: staffId,
        date,
        planned_start: plannedStart,
        planned_end: plannedEnd,
        status,
        notes: notes || null,
      };
      if (actualStart) {
        updateData.actual_start = new Date(`${date}T${actualStart}:00`).toISOString();
      }
      if (actualEnd) {
        updateData.actual_end = new Date(`${date}T${actualEnd}:00`).toISOString();
      }
      onSubmit({ id: initialData.id, data: updateData, mode: 'edit' });
    } else if (repeatEnabled && repeatDays.length > 0) {
      // Bulk create
      const baseDate = new Date(date);
      const entries: any[] = [];
      for (let week = 0; week < repeatWeeks; week++) {
        for (const dayOfWeek of repeatDays) {
          const targetDate = new Date(baseDate);
          const currentDay = baseDate.getDay();
          let daysUntil = dayOfWeek - currentDay;
          if (daysUntil < 0) daysUntil += 7;
          targetDate.setDate(baseDate.getDate() + daysUntil + week * 7);
          const dateStr = getLocalDateString(targetDate);
          entries.push({
            staff_id: staffId,
            date: dateStr,
            planned_start: plannedStart,
            planned_end: plannedEnd,
            actual_start: null,
            actual_end: null,
            status: 'scheduled',
            notes: notes || null,
          });
        }
      }
      onSubmit({ entries, mode: 'bulk' });
    } else {
      onSubmit({
        data: {
          staff_id: staffId,
          date,
          planned_start: plannedStart,
          planned_end: plannedEnd,
          actual_start: null,
          actual_end: null,
          status: 'scheduled',
          notes: notes || null,
        },
        mode: 'create',
      });
    }
  };

  const activeStaff = staffList.filter((s) => s.is_active !== false);

  // Show a subset of common time options for the chip selector
  const commonTimes = TIME_OPTIONS.filter((_, i) => i % 2 === 0); // hourly options

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <ScrollView>
          <Text variant="titleMedium" style={styles.title}>
            {isEdit ? t('schedules.editSchedule') : t('schedules.newSchedule')}
          </Text>

          {/* Staff Selector */}
          <Text variant="bodySmall" style={styles.label}>
            {t('schedules.staffMember')} *
          </Text>
          <View style={styles.chipRow}>
            {activeStaff.map((s) => (
              <Chip key={s.id} compact selected={staffId === s.id} onPress={() => setStaffId(s.id)}>
                {s.full_name}
                {s.role ? ` (${s.role})` : ''}
              </Chip>
            ))}
          </View>

          {/* Date */}
          <TextInput
            label={t('schedules.dateRequired')}
            value={date}
            onChangeText={setDate}
            mode="outlined"
            dense
            placeholder={t('schedules.datePlaceholder')}
            style={styles.input}
          />

          {/* Planned Times */}
          <Text variant="bodySmall" style={styles.label}>
            {t('schedules.startTime')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeChips}
          >
            {commonTimes.map((time) => (
              <Chip
                key={`s-${time}`}
                compact
                selected={plannedStart === time}
                onPress={() => setPlannedStart(time)}
              >
                {time}
              </Chip>
            ))}
          </ScrollView>
          <TextInput
            label={t('schedules.customStart')}
            value={plannedStart}
            onChangeText={setPlannedStart}
            mode="outlined"
            dense
            style={styles.input}
          />

          <Text variant="bodySmall" style={styles.label}>
            {t('schedules.endTime')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeChips}
          >
            {commonTimes.map((time) => (
              <Chip
                key={`e-${time}`}
                compact
                selected={plannedEnd === time}
                onPress={() => setPlannedEnd(time)}
              >
                {time}
              </Chip>
            ))}
          </ScrollView>
          <TextInput
            label={t('schedules.customEnd')}
            value={plannedEnd}
            onChangeText={setPlannedEnd}
            mode="outlined"
            dense
            style={styles.input}
          />

          {/* Edit-only fields */}
          {isEdit && (
            <>
              <Text variant="bodySmall" style={styles.label}>
                {tCommon('status')}
              </Text>
              <View style={styles.chipRow}>
                {STATUSES.map((s) => (
                  <Chip
                    key={s}
                    compact
                    selected={status === s}
                    onPress={() => setStatus(s)}
                    style={status === s ? { backgroundColor: STATUS_COLORS[s] } : undefined}
                    textStyle={status === s ? { color: '#fff', fontWeight: '600' } : undefined}
                  >
                    {t(`schedules.${s}`)}
                  </Chip>
                ))}
              </View>

              <TextInput
                label={t('schedules.actualStart')}
                value={actualStart}
                onChangeText={setActualStart}
                mode="outlined"
                dense
                placeholder={t('schedules.actualStartPlaceholder')}
                style={styles.input}
              />
              <TextInput
                label={t('schedules.actualEnd')}
                value={actualEnd}
                onChangeText={setActualEnd}
                mode="outlined"
                dense
                placeholder={t('schedules.actualEndPlaceholder')}
                style={styles.input}
              />
            </>
          )}

          {/* Notes */}
          <TextInput
            label={t('schedules.notesOptional')}
            value={notes}
            onChangeText={setNotes}
            mode="outlined"
            dense
            multiline
            numberOfLines={2}
            style={styles.input}
          />

          {/* Bulk create (create mode only) */}
          {!isEdit && (
            <View style={styles.repeatSection}>
              <View style={styles.switchRow}>
                <Text variant="bodyMedium">{t('schedules.repeatMultipleDays')}</Text>
                <Switch value={repeatEnabled} onValueChange={setRepeatEnabled} />
              </View>

              {repeatEnabled && (
                <>
                  <Text variant="bodySmall" style={styles.label}>
                    {t('schedules.daysOfWeek')}
                  </Text>
                  <View style={styles.chipRow}>
                    {DAYS_OF_WEEK.map((day) => (
                      <Chip
                        key={day.value}
                        compact
                        selected={repeatDays.includes(day.value)}
                        onPress={() => toggleRepeatDay(day.value)}
                        style={
                          repeatDays.includes(day.value)
                            ? { backgroundColor: BRAND_PRIMARY }
                            : undefined
                        }
                        textStyle={
                          repeatDays.includes(day.value)
                            ? { color: '#fff', fontWeight: '600' }
                            : undefined
                        }
                      >
                        {day.label}
                      </Chip>
                    ))}
                  </View>

                  <Text variant="bodySmall" style={styles.label}>
                    {t('schedules.numberOfWeeks')}
                  </Text>
                  <View style={styles.chipRow}>
                    {[1, 2, 3, 4].map((n) => (
                      <Chip
                        key={n}
                        compact
                        selected={repeatWeeks === n}
                        onPress={() => setRepeatWeeks(n)}
                      >
                        {n} {n > 1 ? t('schedules.weeks') : t('schedules.week')}
                      </Chip>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {isEdit && onDelete && (
              <Button
                mode="outlined"
                textColor="#ef4444"
                style={styles.deleteBtn}
                onPress={() => onDelete(initialData.id)}
              >
                {tCommon('delete')}
              </Button>
            )}
            <View style={styles.spacer} />
            <Button onPress={onDismiss}>{tCommon('cancel')}</Button>
            <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={!staffId}>
              {isEdit ? tCommon('update') : tCommon('create')}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 12, maxHeight: '90%' },
  title: { fontWeight: '700', marginBottom: 12 },
  label: { color: '#6b7280', marginBottom: 4, marginTop: 4 },
  input: { marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  timeChips: { gap: 6, paddingBottom: 6 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  repeatSection: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  deleteBtn: { borderColor: '#fca5a5' },
  spacer: { flex: 1 },
});
