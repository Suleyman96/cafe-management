import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Card, Text, TextInput } from 'react-native-paper';
import type { SettingsSectionProps } from './ToggleRow';
import { ToggleRow } from './ToggleRow';

export function OrderSettingsSection({ form, updateField }: SettingsSectionProps) {
  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="clipboard-list" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Order Settings
          </Text>
        </View>
        <TextInput
          label={`Minimum Order Amount (${form.currency_symbol || '₼'})`}
          value={String(form.minimum_order_amount ?? '')}
          onChangeText={(v) => updateField('minimum_order_amount', Number.parseFloat(v) || 0)}
          mode="outlined"
          keyboardType="decimal-pad"
          dense
          style={styles.input}
        />
        <ToggleRow
          label="Allow Item Notes"
          description="Customers can add notes to items"
          value={!!form.allow_item_notes}
          onChange={(v) => updateField('allow_item_notes', v)}
        />
        <ToggleRow
          label="Allow Order Notes"
          description="Customers can add notes to orders"
          value={!!form.allow_order_notes}
          onChange={(v) => updateField('allow_order_notes', v)}
        />
        <ToggleRow
          label="Enable Tips"
          description="Allow staff to accept tips"
          value={!!form.tips_enabled}
          onChange={(v) => updateField('tips_enabled', v)}
        />
        <ToggleRow
          label="Waste Tracking"
          description="Track food waste and costs"
          value={!!form.waste_tracking_enabled}
          onChange={(v) => updateField('waste_tracking_enabled', v)}
        />
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', color: '#1e293b' },
  input: { marginBottom: 8 },
});
