import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';
import { ToggleRow } from './ToggleRow';

export function TaxSettingsSection({ form, updateField }: SettingsSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="receipt" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('cafeSettings.taxSettings')}
          </Text>
        </View>
        <ToggleRow
          label={t('cafeSettings.enableTax')}
          description={t('cafeSettings.turnOnTax')}
          value={!!form.tax_enabled}
          onChange={(v) => updateField('tax_enabled', v)}
        />
        {!!form.tax_enabled && (
          <>
            <TextInput
              label={t('cafeSettings.taxPercentage')}
              value={String(form.tax_percentage ?? '')}
              onChangeText={(v: string) => updateField('tax_percentage', Number.parseFloat(v) || 0)}
              mode="outlined"
              keyboardType="decimal-pad"
              dense
              style={styles.input}
            />
            <TextInput
              label={t('cafeSettings.taxLabel')}
              value={form.tax_label || ''}
              onChangeText={(v: string) => updateField('tax_label', v)}
              mode="outlined"
              dense
              style={styles.input}
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
