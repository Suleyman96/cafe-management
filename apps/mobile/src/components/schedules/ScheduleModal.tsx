import { DAYS_OF_WEEK, TIME_OPTIONS } from '@cafe-idare/core';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Modal, Portal, Switch, Text } from 'react-native-paper';
import { getLocalDateString } from '@/lib/date-utils';
import { TextInput } from '@/lib/paper-compat';

const STATUSES = ['scheduled', 'in_progress', 'completed', 'missed'] as const;
const STATUS_COLORS: Record<string, string> = {
  scheduled: '#6b7280',
  in_progress: '#3b82f6',
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
  }, [initialData, defaultDate]);

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
          planned_start: `${date}T${plannedStart}:00`,
          planned_end: `${date}T${plannedEnd}:00`,
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
            {isEdit ? 'Edit Schedule' : 'New Schedule'}
          </Text>

          {/* Staff Selector */}
          <Text variant="bodySmall" style={styles.label}>
            Staff Member *
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
            label="Date *"
            value={date}
            onChangeText={setDate}
            mode="outlined"
            dense
            placeholder="YYYY-MM-DD"
            style={styles.input}
          />

          {/* Planned Times */}
          <Text variant="bodySmall" style={styles.label}>
            Start Time
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeChips}
          >
            {commonTimes.map((t) => (
              <Chip
                key={`s-${t}`}
                compact
                selected={plannedStart === t}
                onPress={() => setPlannedStart(t)}
              >
                {t}
              </Chip>
            ))}
          </ScrollView>
          <TextInput
            label="Custom start (HH:MM)"
            value={plannedStart}
            onChangeText={setPlannedStart}
            mode="outlined"
            dense
            style={styles.input}
          />

          <Text variant="bodySmall" style={styles.label}>
            End Time
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.timeChips}
          >
            {commonTimes.map((t) => (
              <Chip
                key={`e-${t}`}
                compact
                selected={plannedEnd === t}
                onPress={() => setPlannedEnd(t)}
              >
                {t}
              </Chip>
            ))}
          </ScrollView>
          <TextInput
            label="Custom end (HH:MM)"
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
                Status
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
                    {s.replace(/_/g, ' ')}
                  </Chip>
                ))}
              </View>

              <TextInput
                label="Actual Start (HH:MM)"
                value={actualStart}
                onChangeText={setActualStart}
                mode="outlined"
                dense
                placeholder="e.g. 09:05"
                style={styles.input}
              />
              <TextInput
                label="Actual End (HH:MM)"
                value={actualEnd}
                onChangeText={setActualEnd}
                mode="outlined"
                dense
                placeholder="e.g. 17:15"
                style={styles.input}
              />
            </>
          )}

          {/* Notes */}
          <TextInput
            label="Notes (optional)"
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
                <Text variant="bodyMedium">Repeat on multiple days</Text>
                <Switch value={repeatEnabled} onValueChange={setRepeatEnabled} />
              </View>

              {repeatEnabled && (
                <>
                  <Text variant="bodySmall" style={styles.label}>
                    Days of week
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
                            ? { backgroundColor: '#3b82f6' }
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
                    Number of weeks
                  </Text>
                  <View style={styles.chipRow}>
                    {[1, 2, 3, 4].map((n) => (
                      <Chip
                        key={n}
                        compact
                        selected={repeatWeeks === n}
                        onPress={() => setRepeatWeeks(n)}
                      >
                        {n} week{n > 1 ? 's' : ''}
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
                Delete
              </Button>
            )}
            <View style={styles.spacer} />
            <Button onPress={onDismiss}>Cancel</Button>
            <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={!staffId}>
              {isEdit ? 'Update' : 'Create'}
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
