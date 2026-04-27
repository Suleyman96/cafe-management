import type { CafeSettings } from '@gustri/database';
import { StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

export interface SettingsSectionProps {
  form: Partial<CafeSettings> & Record<string, unknown>;
  updateField: (key: string, value: boolean | string | number | null) => void;
  /** Per-field validation errors keyed by CafeSettings column name. Optional. */
  fieldErrors?: Record<string, string>;
}

interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textArea}>
        <Text variant="bodyMedium">{label}</Text>
        {description && (
          <Text variant="bodySmall" style={styles.description}>
            {description}
          </Text>
        )}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  textArea: { flex: 1, marginRight: 12 },
  description: { color: '#6b7280', fontSize: 11 },
});
