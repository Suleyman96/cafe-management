import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LANGUAGES, useTranslation } from '@gustri/i18n';
import { StyleSheet, View } from 'react-native';
import { Card, Chip, HelperText, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import type { SettingsSectionProps } from './ToggleRow';

const SUPPORTED_LANGUAGE_CODES = ['ja', 'en', 'ko', 'ru'] as const;
const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGE_CODES.map((code) => {
  const lang = LANGUAGES.find((l) => l.code === code);
  return { code, label: lang?.nativeName ?? code };
});

export function RestaurantInfoSection({ form, updateField, fieldErrors }: SettingsSectionProps) {
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
          error={!!fieldErrors?.restaurant_name}
          style={styles.input}
        />
        {fieldErrors?.restaurant_name && (
          <HelperText type="error" visible>
            {fieldErrors.restaurant_name}
          </HelperText>
        )}
        <TextInput
          label={t('cafeSettings.restaurantAddress')}
          value={form.restaurant_address || ''}
          onChangeText={(v: string) => updateField('restaurant_address', v || null)}
          mode="outlined"
          dense
          placeholder={t('cafeSettings.restaurantAddressPlaceholder')}
          error={!!fieldErrors?.restaurant_address}
          style={styles.input}
        />
        {fieldErrors?.restaurant_address && (
          <HelperText type="error" visible>
            {fieldErrors.restaurant_address}
          </HelperText>
        )}
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
