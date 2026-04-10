import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'az', label: 'Azerbaijani' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
];

export function RestaurantInfoSection({ form, updateField }: SettingsSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="store" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            {t('cafeSettings.restaurantInformation')}
          </Text>
        </View>
        <TextInput
          label={t('cafeSettings.restaurantName')}
          value={form.restaurant_name || ''}
          onChangeText={(v: string) => updateField('restaurant_name', v)}
          mode="outlined"
          dense
          style={styles.input}
        />
        <TextInput
          label={t('cafeSettings.restaurantAddress')}
          value={form.restaurant_address || ''}
          onChangeText={(v: string) => updateField('restaurant_address', v || null)}
          mode="outlined"
          dense
          placeholder="123 Main Street, City, Country"
          style={styles.input}
        />
        <Text variant="labelMedium" style={styles.fieldLabel}>
          {t('cafeSettings.defaultMenuLanguage')}
        </Text>
        <Text variant="bodySmall" style={styles.helperText}>
          {t('cafeSettings.languageHint')}
        </Text>
        <View style={styles.chipRow}>
          {LANGUAGE_OPTIONS.map((lang) => (
            <Chip
              key={lang.code}
              selected={form.default_language === lang.code}
              onPress={() => updateField('default_language', lang.code)}
              compact
            >
              {lang.label}
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
  fieldLabel: { color: '#374151', marginBottom: 4, marginTop: 4 },
  helperText: { color: '#6b7280', marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
});
