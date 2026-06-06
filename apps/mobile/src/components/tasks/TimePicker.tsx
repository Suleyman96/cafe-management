import { TIME_OPTIONS } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { ScrollView, StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';

// Generate time options in HH:MM format (30-min intervals)
const TIME_SLOTS = TIME_OPTIONS;

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function TimePicker({ value, onChange, open, onToggle }: TimePickerProps) {
  const { t } = useTranslation('staff');

  return (
    <>
      <Chip icon="clock-outline" onPress={onToggle} style={styles.pickerChip}>
        {value || t('tasks.noTimeSet')}
      </Chip>
      {open && (
        <ScrollView style={styles.timePickerList} nestedScrollEnabled>
          <Chip
            selected={!value}
            onPress={() => {
              onChange('');
              onToggle();
            }}
            compact
            style={styles.pickerItem}
          >
            {t('tasks.noTime')}
          </Chip>
          {TIME_SLOTS.map((time) => (
            <Chip
              key={time}
              selected={value === time}
              onPress={() => {
                onChange(time);
                onToggle();
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
  );
}

const styles = StyleSheet.create({
  pickerChip: { alignSelf: 'flex-start', marginBottom: 4 },
  pickerItem: { marginBottom: 2 },
  timePickerList: {
    maxHeight: 150,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
});
