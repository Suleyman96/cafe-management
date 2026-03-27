import { TIME_OPTIONS, WEEKDAYS } from '@cafe-idare/core';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Modal, Portal, Switch, Text, TextInput } from 'react-native-paper';
import { useStaff } from '@/hooks';
import { getLocalDateString } from '@/lib/date-utils';
import type { Task } from '@/types';

const PRIORITIES = [
  { value: 'low' as const, label: 'Low', bg: '#f3f4f6', text: '#374151' },
  { value: 'normal' as const, label: 'Normal', bg: '#dbeafe', text: '#1d4ed8' },
  { value: 'high' as const, label: 'High', bg: '#ffedd5', text: '#c2410c' },
  { value: 'urgent' as const, label: 'Urgent', bg: '#fee2e2', text: '#dc2626' },
];

const PATTERNS = [
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

// Generate time options in HH:MM format (30-min intervals)
const TIME_SLOTS = TIME_OPTIONS;

interface TaskModalProps {
  task: Task | null;
  staffId?: string;
  isAdmin: boolean;
  onSave: (data: any) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

export function TaskModal({ task, staffId, isAdmin, onSave, isSaving, onClose }: TaskModalProps) {
  const isEditing = !!task;
  const { data: staffList = [] } = useStaff();

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'normal');
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to || staffId || '');
  const [dueDate, setDueDate] = useState(
    task?.due_date || (task?.is_recurring ? '' : getLocalDateString()),
  );
  const [dueTime, setDueTime] = useState(task?.due_time || '');
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring || false);
  const [recurrencePattern, setRecurrencePattern] = useState(task?.recurrence_pattern || 'daily');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(task?.recurrence_days || []);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showStaffPicker, setShowStaffPicker] = useState(false);

  const activeStaff = (staffList as any[]).filter((s: any) => s.is_active);
  const selectedStaffName =
    activeStaff.find((s: any) => s.id === assignedTo)?.full_name || 'Unassigned';

  const toggleWeekday = (day: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) return;

    const data: any = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assignedTo || null,
      created_by: staffId || null,
      status: 'pending',
    };

    if (isRecurring) {
      data.is_recurring = true;
      data.recurrence_pattern = recurrencePattern;
      data.recurrence_days =
        recurrencePattern === 'weekly' || recurrencePattern === 'monthly' ? recurrenceDays : [];
      data.due_time = dueTime || null;
    } else {
      data.is_recurring = false;
      data.due_date = dueDate || null;
      data.due_time = dueTime || null;
    }

    onSave(data);
  };

  return (
    <Portal>
      <Modal visible onDismiss={onClose} contentContainerStyle={styles.modal}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text variant="titleMedium" style={styles.header}>
            {isEditing ? 'Edit Task' : 'New Task'}
          </Text>

          {/* Title */}
          <TextInput
            label="Title *"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            dense
            style={styles.input}
            placeholder="What needs to be done?"
          />

          {/* Description */}
          <TextInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            dense
            multiline
            numberOfLines={2}
            style={styles.input}
          />

          {/* Assign To */}
          <Text variant="labelMedium" style={styles.label}>
            Assign To
          </Text>
          <Chip
            icon="account"
            onPress={() => setShowStaffPicker(!showStaffPicker)}
            style={styles.pickerChip}
          >
            {selectedStaffName}
          </Chip>
          {showStaffPicker && (
            <View style={styles.pickerList}>
              <Chip
                selected={!assignedTo}
                onPress={() => {
                  setAssignedTo('');
                  setShowStaffPicker(false);
                }}
                compact
                style={styles.pickerItem}
              >
                Unassigned
              </Chip>
              {activeStaff.map((s: any) => (
                <Chip
                  key={s.id}
                  selected={assignedTo === s.id}
                  onPress={() => {
                    setAssignedTo(s.id);
                    setShowStaffPicker(false);
                  }}
                  compact
                  style={styles.pickerItem}
                >
                  {s.full_name} ({s.role})
                </Chip>
              ))}
            </View>
          )}

          {/* Priority */}
          <Text variant="labelMedium" style={styles.label}>
            Priority
          </Text>
          <View style={styles.row}>
            {PRIORITIES.map((p) => (
              <Chip
                key={p.value}
                selected={priority === p.value}
                onPress={() => setPriority(p.value)}
                compact
                style={[styles.priorityChip, priority === p.value && { backgroundColor: p.bg }]}
                textStyle={priority === p.value ? { color: p.text, fontWeight: '600' } : undefined}
              >
                {p.label}
              </Chip>
            ))}
          </View>

          {/* Due Date + Time (non-recurring only) */}
          {!isRecurring && (
            <>
              <Text variant="labelMedium" style={styles.label}>
                Due Date
              </Text>
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                mode="outlined"
                dense
                placeholder="YYYY-MM-DD"
                style={styles.input}
              />

              <Text variant="labelMedium" style={styles.label}>
                Due Time
              </Text>
              <Chip
                icon="clock-outline"
                onPress={() => setShowTimePicker(!showTimePicker)}
                style={styles.pickerChip}
              >
                {dueTime || 'No time set'}
              </Chip>
              {showTimePicker && (
                <ScrollView style={styles.timePickerList} nestedScrollEnabled>
                  <Chip
                    selected={!dueTime}
                    onPress={() => {
                      setDueTime('');
                      setShowTimePicker(false);
                    }}
                    compact
                    style={styles.pickerItem}
                  >
                    No time
                  </Chip>
                  {TIME_SLOTS.map((time) => (
                    <Chip
                      key={time}
                      selected={dueTime === time}
                      onPress={() => {
                        setDueTime(time);
                        setShowTimePicker(false);
                      }}
                      compact
                      style={styles.pickerItem}
                    >
                      {time}
                    </Chip>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          {/* Recurring Toggle (admin only) */}
          {isAdmin && (
            <View style={styles.switchRow}>
              <Text variant="labelMedium">Make Recurring</Text>
              <Switch
                value={isRecurring}
                onValueChange={(v) => {
                  setIsRecurring(v);
                  if (v) setDueDate('');
                  else setDueDate(getLocalDateString());
                }}
              />
            </View>
          )}

          {/* Recurrence Settings */}
          {isRecurring && isAdmin && (
            <View style={styles.recurringSection}>
              <Text variant="labelMedium" style={styles.recurringLabel}>
                Recurrence Pattern
              </Text>
              <View style={styles.row}>
                {PATTERNS.map((p) => (
                  <Chip
                    key={p.value}
                    selected={recurrencePattern === p.value}
                    onPress={() => {
                      setRecurrencePattern(p.value);
                      setRecurrenceDays([]);
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
                    Which days?
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
                        {day.label}
                      </Chip>
                    ))}
                  </View>
                </>
              )}

              {/* Monthly: day of month */}
              {recurrencePattern === 'monthly' && (
                <>
                  <Text variant="labelSmall" style={styles.recurringSubLabel}>
                    Day of month
                  </Text>
                  <TextInput
                    value={recurrenceDays[0]?.toString() || ''}
                    onChangeText={(v) => {
                      const num = Number.parseInt(v, 10);
                      setRecurrenceDays(num >= 1 && num <= 31 ? [num] : []);
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
                Default due time
              </Text>
              <Chip
                icon="clock-outline"
                onPress={() => setShowTimePicker(!showTimePicker)}
                style={styles.pickerChip}
              >
                {dueTime || 'No time set'}
              </Chip>
              {showTimePicker && (
                <ScrollView style={styles.timePickerList} nestedScrollEnabled>
                  <Chip
                    selected={!dueTime}
                    onPress={() => {
                      setDueTime('');
                      setShowTimePicker(false);
                    }}
                    compact
                    style={styles.pickerItem}
                  >
                    No time
                  </Chip>
                  {TIME_SLOTS.map((time) => (
                    <Chip
                      key={time}
                      selected={dueTime === time}
                      onPress={() => {
                        setDueTime(time);
                        setShowTimePicker(false);
                      }}
                      compact
                      style={styles.pickerItem}
                    >
                      {time}
                    </Chip>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Button onPress={onClose} style={styles.actionBtn}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isSaving}
              disabled={!title.trim() || isSaving}
              style={styles.actionBtn}
            >
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    maxHeight: '85%',
  },
  header: { fontWeight: '700', marginBottom: 16 },
  input: { marginBottom: 8 },
  label: { color: '#374151', marginBottom: 6, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  priorityChip: {},
  pickerChip: { alignSelf: 'flex-start', marginBottom: 4 },
  pickerList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  pickerItem: { marginBottom: 2 },
  timePickerList: {
    maxHeight: 150,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionBtn: {},
});
