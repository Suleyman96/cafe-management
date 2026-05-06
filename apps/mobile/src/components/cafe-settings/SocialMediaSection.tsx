import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';

const SOCIAL_FIELDS = [
  {
    key: 'social_instagram',
    labelKey: 'cafeSettings.instagram',
    placeholderKey: 'instagramPlaceholder',
  },
  {
    key: 'social_whatsapp',
    labelKey: 'cafeSettings.whatsapp',
    placeholderKey: 'whatsappPlaceholder',
  },
  { key: 'social_tiktok', labelKey: 'cafeSettings.tiktok', placeholderKey: 'tiktokPlaceholder' },
  {
    key: 'social_telegram',
    labelKey: 'cafeSettings.telegram',
    placeholderKey: 'telegramPlaceholder',
  },
  { key: 'social_line', labelKey: 'cafeSettings.line', placeholderKey: 'linePlaceholder' },
  {
    key: 'location_maps_url',
    labelKey: 'cafeSettings.googleMaps',
    placeholderKey: 'googleMapsPlaceholder',
  },
] as const;

export function SocialMediaSection({ form, updateField }: SettingsSectionProps) {
  const { t } = useTranslation('staff');
  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="earth" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('cafeSettings.socialMedia')}
          </Text>
        </View>
        {SOCIAL_FIELDS.map((field) => (
          <TextInput
            key={field.key}
            label={t(field.labelKey)}
            value={(form[field.key] as string) || ''}
            onChangeText={(v: string) => updateField(field.key, v || null)}
            mode="outlined"
            dense
            placeholder={t(field.placeholderKey, { ns: 'common' })}
            style={styles.input}
          />
        ))}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontWeight: '700', color: '#1e293b' },
  input: { marginBottom: 8 },
});
