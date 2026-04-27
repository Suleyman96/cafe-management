import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';
import { ToggleRow } from './ToggleRow';

export function OrderSettingsSection({ form, updateField }: SettingsSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="clipboard-list" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('cafeSettings.orderSettings')}
          </Text>
        </View>
        <TextInput
          label={`${t('cafeSettings.minimumOrderAmount')} (${form.currency_symbol || '$'})`}
          value={String(form.minimum_order_amount ?? '')}
          onChangeText={(v: string) =>
            updateField('minimum_order_amount', Number.parseFloat(v) || 0)
          }
          mode="outlined"
          keyboardType="decimal-pad"
          dense
          style={styles.input}
        />
        <ToggleRow
          label={t('cafeSettings.allowItemNotes')}
          description={t('cafeSettings.customerItemNotes')}
          value={!!form.allow_item_notes}
          onChange={(v) => updateField('allow_item_notes', v)}
        />
        <ToggleRow
          label={t('cafeSettings.allowOrderNotes')}
          description={t('cafeSettings.customerOrderNotes')}
          value={!!form.allow_order_notes}
          onChange={(v) => updateField('allow_order_notes', v)}
        />
        <ToggleRow
          label={t('cafeSettings.enableTips')}
          description={t('cafeSettings.allowTips')}
          value={!!form.tips_enabled}
          onChange={(v) => updateField('tips_enabled', v)}
        />
        <ToggleRow
          label={t('cafeSettings.wasteTracking')}
          description={t('cafeSettings.trackWaste')}
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
