import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Card, Text, TextInput } from 'react-native-paper';
import type { SettingsSectionProps } from './ToggleRow';
import { ToggleRow } from './ToggleRow';

export function BrandingSection({ form, updateField }: SettingsSectionProps) {
  return (
    <>
      {/* Welcome Screen */}
      <Card>
        <Card.Content>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="message-text-outline" size={20} color="#4b5563" />
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Welcome Screen
            </Text>
          </View>
          <Text variant="bodySmall" style={styles.helperText}>
            Customize the welcome message shown to customers
          </Text>
          <TextInput
            label="Welcome Heading"
            value={form.welcome_heading || ''}
            onChangeText={(v) => updateField('welcome_heading', v || null)}
            mode="outlined"
            dense
            placeholder="Welcome to our restaurant!"
            style={styles.input}
          />
          <TextInput
            label="Welcome Message"
            value={form.welcome_message || ''}
            onChangeText={(v) => updateField('welcome_message', v || null)}
            mode="outlined"
            dense
            multiline
            numberOfLines={3}
            placeholder="Browse our menu and place your order..."
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
              QR Menu Features
            </Text>
          </View>
          <ToggleRow
            label="Enable QR Ordering"
            description="Allow customers to place orders via QR code menu"
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
