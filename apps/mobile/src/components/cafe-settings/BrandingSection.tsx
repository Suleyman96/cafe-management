import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';
import { ToggleRow } from './ToggleRow';

export function BrandingSection({ form, updateField }: SettingsSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <>
      {/* Welcome Screen */}
      <Card>
        <Card.Content>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="message-text-outline" size={20} color="#4b5563" />
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t('cafeSettings.welcomeScreen')}
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.helperText}>
            {t('cafeSettings.customizeWelcome')}
          </Text>
          <TextInput
            label={t('cafeSettings.welcomeHeading')}
            value={form.welcome_heading || ''}
            onChangeText={(v: string) => updateField('welcome_heading', v || null)}
            mode="outlined"
            dense
            placeholder={t('cafeSettings.welcomeHeadingPlaceholder')}
            style={styles.input}
          />
          <TextInput
            label={t('cafeSettings.welcomeMessage')}
            value={form.welcome_message || ''}
            onChangeText={(v: string) => updateField('welcome_message', v || null)}
            mode="outlined"
            dense
            multiline
            numberOfLines={3}
            placeholder={t('cafeSettings.welcomeMessagePlaceholder')}
            style={styles.input}
          />
        </Card.Content>
      </Card>

      {/* QR Menu Features */}
      <Card>
        <Card.Content>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="qrcode" size={20} color="#4b5563" />
            <Text variant="titleMedium" style={styles.sectionTitle}>
              {t('cafeSettings.qrMenuFeatures')}
            </Text>
          </View>
          <ToggleRow
            label={t('cafeSettings.enableQrOrdering')}
            description={t('cafeSettings.qrOrderingDescription')}
            value={!!form.qr_ordering_enabled}
            onChange={(v) => updateField('qr_ordering_enabled', v)}
          />
        </Card.Content>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', color: '#1e293b' },
  helperText: { color: '#6b7280', marginBottom: 12 },
  input: { marginBottom: 8 },
});
