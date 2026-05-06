import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';

export function ContactInfoSection({ form, updateField }: SettingsSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="phone" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('cafeSettings.contactInformation')}
          </Text>
        </View>
        <Text variant="bodySmall" style={styles.helperText}>
          {t('cafeSettings.contactDetails')}
        </Text>
        <TextInput
          label={t('cafeSettings.phoneNumber')}
          value={form.contact_phone || ''}
          onChangeText={(v: string) => updateField('contact_phone', v || null)}
          mode="outlined"
          keyboardType="phone-pad"
          dense
          placeholder={t('phonePlaceholder', { ns: 'common' })}
          style={styles.input}
        />
        <TextInput
          label={t('cafeSettings.website')}
          value={form.contact_website || ''}
          onChangeText={(v: string) => updateField('contact_website', v || null)}
          mode="outlined"
          keyboardType="url"
          dense
          placeholder={t('websitePlaceholder', { ns: 'common' })}
          style={styles.input}
        />
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', color: '#1e293b' },
  helperText: { color: '#6b7280', marginBottom: 12 },
  input: { marginBottom: 8 },
});
