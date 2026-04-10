import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';
import { ToggleRow } from './ToggleRow';

export function DeliverySection({ form, updateField }: SettingsSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="truck-delivery" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('cafeSettings.deliverySettings')}
          </Text>
        </View>
        <ToggleRow
          label={t('cafeSettings.enableDelivery')}
          description={t('cafeSettings.allowDeliveryOrders')}
          value={!!form.delivery_enabled}
          onChange={(v) => updateField('delivery_enabled', v)}
        />
        {!!form.delivery_enabled && (
          <>
            <TextInput
              label={`${t('cafeSettings.defaultDeliveryFee')} (${form.currency_symbol || '₼'})`}
              value={String(form.delivery_fee_default ?? '')}
              onChangeText={(v: string) =>
                updateField('delivery_fee_default', Number.parseFloat(v) || 0)
              }
              mode="outlined"
              keyboardType="decimal-pad"
              dense
              style={styles.input}
            />
            <TextInput
              label={`${t('cafeSettings.minimumDeliveryAmount')} (${form.currency_symbol || '₼'})`}
              value={String(form.minimum_delivery_amount ?? '')}
              onChangeText={(v: string) =>
                updateField('minimum_delivery_amount', Number.parseFloat(v) || 0)
              }
              mode="outlined"
              keyboardType="decimal-pad"
              dense
              style={styles.input}
            />
            <TextInput
              label={t('cafeSettings.deliveryZoneInfo')}
              value={form.delivery_zone_info || ''}
              onChangeText={(v: string) => updateField('delivery_zone_info', v || null)}
              mode="outlined"
              dense
              multiline
              numberOfLines={2}
              placeholder={t('cafeSettings.describeDeliveryArea')}
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
