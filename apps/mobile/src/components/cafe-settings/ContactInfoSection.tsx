import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Card, Text, TextInput } from 'react-native-paper';
import type { SettingsSectionProps } from './ToggleRow';

export function ContactInfoSection({ form, updateField }: SettingsSectionProps) {
  return (
    <Card>
      <Card.Content>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="phone" size={20} color="#4b5563" />
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Contact Information
          </Text>
        </View>
        <Text variant="bodySmall" style={styles.helperText}>
          Contact details shown to customers
        </Text>
        <TextInput
          label="Phone Number"
          value={form.contact_phone || ''}
          onChangeText={(v) => updateField('contact_phone', v || null)}
          mode="outlined"
          keyboardType="phone-pad"
          dense
          placeholder="+994 50 123 45 67"
          style={styles.input}
        />
        <TextInput
          label="Website"
          value={form.contact_website || ''}
          onChangeText={(v) => updateField('contact_website', v || null)}
          mode="outlined"
          keyboardType="url"
          dense
          placeholder="https://yourrestaurant.com"
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
