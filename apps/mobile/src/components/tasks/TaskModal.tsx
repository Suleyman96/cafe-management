import { TIME_OPTIONS, WEEKDAYS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Modal, Portal, Switch } from 'react-native-paper';
import { useStaff } from '@/hooks';
import { getLocalDateString } from '@/lib/date-utils';
import { Text, TextInput } from '@/lib/paper-compat';
import { COLORS } from '@/theme';
import type { Staff, Task } from '@/types';

// Generate time options in HH:MM format (30-min intervals)
const TIME_SLOTS = TIME_OPTIONS;

interface TaskModalProps {
  task: Task | null;
  staffId?: string;
  isAdmin: boolean;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  isSaving: boolean;
  onClose: () => void;
}

export function TaskModal({ task, staffId, isAdmin, onSave, isSaving, onClose }: TaskModalProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
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

  const PRIORITIES = [
    { value: 'low' as const, label: t('tasks.low'), bg: '#f3f4f6', text: '#374151' },
    { value: 'normal' as const, label: t('tasks.normal'), bg: '#dbeafe', text: '#1d4ed8' },
    { value: 'high' as const, label: t('tasks.high'), bg: '#ffedd5', text: '#c2410c' },
    { value: 'urgent' as const, label: t('tasks.urgent'), bg: '#fee2e2', text: '#dc2626' },
  ];

  const PATTERNS = [
    { value: 'daily' as const, label: t('tasks.daily') },
    { value: 'weekly' as const, label: t('tasks.weekly') },
    { value: 'monthly' as const, label: t('tasks.monthly') },
  ];

  const activeStaff = (staffList as Staff[]).filter((s) => s.is_active);
  const selectedStaffName =
    activeStaff.find((s) => s.id === assignedTo)?.full_name || t('tasks.unassigned');

  const toggleWeekday = (day: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const isDueDateValid = !dueDate || dateRegex.test(dueDate);

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (!isRecurring && dueDate && !isDueDateValid) return;

    const data: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assignedTo || null,
    };

    // Only set created_by and status when creating a new task
    if (!isEditing) {
      data.created_by = staffId || null;
      data.status = 'pending';
    }

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
            {isEditing ? t('tasks.editTask') : t('tasks.newTask')}
          </Text>

          {/* Title */}
          <TextInput
            label={t('tasks.titleLabel')}
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            dense
            style={styles.input}
            placeholder={t('tasks.whatNeedsDone')}
          />

          {/* Description */}
          <TextInput
            label={tCommon('description')}
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
            {t('tasks.assignTo')}
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
                {t('tasks.unassigned')}
              </Chip>
              {activeStaff.map((s) => (
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
            {t('tasks.priority')}
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
                {t('tasks.dueDate')}
              </Text>
              <TextInput
                value={dueDate}
                onChangeText={setDueDate}
                mode="outlined"
                dense
                placeholder="YYYY-MM-DD"
                style={styles.input}
                error={!!dueDate && !isDueDateValid}
              />

              <Text variant="labelMedium" style={styles.label}>
                {t('tasks.dueTime')}
              </Text>
              <Chip
                icon="clock-outline"
                onPress={() => setShowTimePicker(!showTimePicker)}
                style={styles.pickerChip}
              >
                {dueTime || t('tasks.noTimeSet')}
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
                    {t('tasks.noTime')}
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
              <Text variant="labelMedium">{t('tasks.makeRecurring')}</Text>
              <Switch
                value={isRecurring}
                onValueChange={(v: boolean) => {
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
                {t('tasks.recurrencePattern')}
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
                    {t('tasks.dayOfMonth')}
                  </Text>
                  <TextInput
                    value={recurrenceDays[0]?.toString() || ''}
                    onChangeText={(v: string) => {
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
                {t('tasks.defaultDueTime')}
              </Text>
              <Chip
                icon="clock-outline"
                onPress={() => setShowTimePicker(!showTimePicker)}
                style={styles.pickerChip}
              >
                {dueTime || t('tasks.noTimeSet')}
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
                    {t('tasks.noTime')}
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
              {tCommon('cancel')}
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isSaving}
              disabled={!title.trim() || isSaving}
              style={styles.actionBtn}
            >
              {isEditing ? tCommon('update') : tCommon('create')}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: COLORS.card,
    margin: 16,
    padding: 20,
    borderRadius: 12,
    maxHeight: '85%',
  },
  header: { fontWeight: '700', marginBottom: 16 },
  input: { marginBottom: 8 },
  label: { color: COLORS.textPrimary, marginBottom: 6, marginTop: 8 },
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
    borderTopColor: COLORS.border,
  },
  actionBtn: {},
});
