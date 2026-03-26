import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Card, Text, TextInput } from 'react-native-paper';
import type { SettingsSectionProps } from './ToggleRow';
import { ToggleRow } from './ToggleRow';

export function TaxSettingsSection({ form, updateField }: SettingsSectionProps) {
  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="receipt" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Tax Settings
          </Text>
        </View>
        <ToggleRow
          label="Enable Tax"
          description="Turn on tax for orders"
          value={!!form.tax_enabled}
          onChange={(v) => updateField('tax_enabled', v)}
        />
        {!!form.tax_enabled && (
          <>
            <TextInput
              label="Tax Percentage (%)"
              value={String(form.tax_percentage ?? '')}
              onChangeText={(v) => updateField('tax_percentage', Number.parseFloat(v) || 0)}
              mode="outlined"
              keyboardType="decimal-pad"
              dense
              style={styles.input}
            />
            <TextInput
              label="Tax Label"
              value={form.tax_label || ''}
              onChangeText={(v) => updateField('tax_label', v)}
              mode="outlined"
              dense
              style={styles.input}
            />
            <ToggleRow
              label="Prices Include Tax"
              description="Menu prices already include tax"
              value={!!form.prices_include_tax}
              onChange={(v) => updateField('prices_include_tax', v)}
            />
            <ToggleRow
              label="Show Tax Separately"
              description="Display tax as a separate line"
              value={!!form.show_tax_separately}
              onChange={(v) => updateField('show_tax_separately', v)}
            />
          </>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', color: '#1e293b' },
  input: { marginBottom: 8 },
});
