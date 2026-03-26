import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text, TextInput } from 'react-native-paper';
import type { SettingsSectionProps } from './ToggleRow';

const POSITION_OPTIONS = [
  { value: 'before', label: 'Before ($10)' },
  { value: 'after', label: 'After (10$)' },
];

export function CurrencySection({ form, updateField }: SettingsSectionProps) {
  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="currency-usd" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Currency Settings
          </Text>
        </View>
        <View style={styles.row}>
          <TextInput
            label="Currency Symbol"
            value={form.currency_symbol || ''}
            onChangeText={(v) => updateField('currency_symbol', v)}
            mode="outlined"
            dense
            style={[styles.input, styles.flex1]}
          />
          <TextInput
            label="Currency Code"
            value={form.currency_code || ''}
            onChangeText={(v) => updateField('currency_code', v.toUpperCase())}
            mode="outlined"
            dense
            maxLength={3}
            style={[styles.input, styles.flex1]}
          />
        </View>
        <Text variant="labelMedium" style={styles.fieldLabel}>
          Symbol Position
        </Text>
        <View style={styles.chipRow}>
          {POSITION_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              selected={form.currency_position === opt.value}
              onPress={() => updateField('currency_position', opt.value)}
              compact
            >
              {opt.label}
            </Chip>
          ))}
        </View>
        <Text variant="labelMedium" style={styles.fieldLabel}>
          Decimal Places
        </Text>
        <View style={styles.chipRow}>
          {[0, 1, 2].map((n) => (
            <Chip
              key={n}
              selected={form.currency_decimal_places === n}
              onPress={() => updateField('currency_decimal_places', n)}
              compact
            >
              {n} ({n === 0 ? '10' : n === 1 ? '10.5' : '10.50'})
            </Chip>
          ))}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', color: '#1e293b' },
  input: { marginBottom: 8 },
  fieldLabel: { color: '#374151', marginBottom: 6, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
});
