import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';

const SOCIAL_FIELDS = [
  {
    key: 'social_instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/yourrestaurant',
  },
  { key: 'social_whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/XXXXXXXXXXXX' },
  { key: 'social_tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourrestaurant' },
  { key: 'social_telegram', label: 'Telegram', placeholder: 'https://t.me/yourrestaurant' },
  { key: 'social_line', label: 'LINE', placeholder: 'https://line.me/R/ti/p/@yourrestaurant' },
  {
    key: 'location_maps_url',
    label: 'Google Maps',
    placeholder: 'https://g.page/yourrestaurant',
  },
];

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
            label={field.label}
            value={(form[field.key] as string) || ''}
            onChangeText={(v: string) => updateField(field.key, v || null)}
            mode="outlined"
            dense
            placeholder={field.placeholder}
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
