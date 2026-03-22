import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Switch, Text } from 'react-native-paper';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCafeSettings, useUpdateCafeSettings } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { TextInput } from '@/lib/paper-compat';

export default function CafeSettingsScreen() {
  const { showSuccess, showError } = useSnackbar();
  const { data: settings, isLoading, error, refetch } = useCafeSettings();
  const updateSettings = useUpdateCafeSettings();

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form);
      showSuccess('Settings saved');
      setHasChanges(false);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to save settings');
    }
  };

  const handleReset = () => {
    if (settings) {
      setForm(settings);
      setHasChanges(false);
    }
  };

  if (isLoading) return <LoadingScreen message="Loading settings..." />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* General */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              General
            </Text>
            <TextInput
              label="Restaurant Name"
              value={(form.restaurant_name as string) || ''}
              onChangeText={(v: string) => updateField('restaurant_name', v)}
              mode="outlined"
              dense
              style={styles.input}
            />
            <TextInput
              label="Address"
              value={(form.address as string) || ''}
              onChangeText={(v: string) => updateField('address', v)}
              mode="outlined"
              dense
              multiline
              style={styles.input}
            />
          </Card.Content>
        </Card>

        {/* Tax Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Tax
            </Text>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Enable Tax</Text>
              <Switch
                value={!!form.tax_enabled}
                onValueChange={(v: boolean) => updateField('tax_enabled', v)}
              />
            </View>
            {!!form.tax_enabled && (
              <>
                <TextInput
                  label="Tax Percentage"
                  value={String(form.tax_percentage || '')}
                  onChangeText={(v: string) => updateField('tax_percentage', parseFloat(v) || 0)}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  dense
                  style={styles.input}
                />
                <TextInput
                  label="Tax Label"
                  value={(form.tax_label as string) || ''}
                  onChangeText={(v: string) => updateField('tax_label', v)}
                  mode="outlined"
                  dense
                  style={styles.input}
                />
                <View style={styles.switchRow}>
                  <Text variant="bodyMedium">Prices Include Tax</Text>
                  <Switch
                    value={!!form.prices_include_tax}
                    onValueChange={(v: boolean) => updateField('prices_include_tax', v)}
                  />
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Currency */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Currency
            </Text>
            <TextInput
              label="Currency Symbol"
              value={(form.currency_symbol as string) || ''}
              onChangeText={(v: string) => updateField('currency_symbol', v)}
              mode="outlined"
              dense
              style={styles.input}
            />
            <TextInput
              label="Currency Code"
              value={(form.currency_code as string) || ''}
              onChangeText={(v: string) => updateField('currency_code', v)}
              mode="outlined"
              dense
              style={styles.input}
            />
            <TextInput
              label="Decimal Places"
              value={String(form.decimal_places ?? '')}
              onChangeText={(v: string) => updateField('decimal_places', parseInt(v, 10) || 0)}
              mode="outlined"
              keyboardType="number-pad"
              dense
              style={styles.input}
            />
          </Card.Content>
        </Card>

        {/* Order Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Orders
            </Text>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Allow Item Notes</Text>
              <Switch
                value={!!form.allow_item_notes}
                onValueChange={(v: boolean) => updateField('allow_item_notes', v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Allow Order Notes</Text>
              <Switch
                value={!!form.allow_order_notes}
                onValueChange={(v: boolean) => updateField('allow_order_notes', v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Tips Enabled</Text>
              <Switch
                value={!!form.tips_enabled}
                onValueChange={(v: boolean) => updateField('tips_enabled', v)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Waste Tracking</Text>
              <Switch
                value={!!form.waste_tracking_enabled}
                onValueChange={(v: boolean) => updateField('waste_tracking_enabled', v)}
              />
            </View>
          </Card.Content>
        </Card>

        {/* Delivery */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Delivery
            </Text>
            <View style={styles.switchRow}>
              <Text variant="bodyMedium">Enable Delivery</Text>
              <Switch
                value={!!form.delivery_enabled}
                onValueChange={(v: boolean) => updateField('delivery_enabled', v)}
              />
            </View>
            {!!form.delivery_enabled && (
              <>
                <TextInput
                  label="Default Delivery Fee"
                  value={String(form.default_delivery_fee || '')}
                  onChangeText={(v: string) =>
                    updateField('default_delivery_fee', parseFloat(v) || 0)
                  }
                  mode="outlined"
                  keyboardType="decimal-pad"
                  dense
                  style={styles.input}
                />
                <TextInput
                  label="Minimum Delivery Amount"
                  value={String(form.minimum_delivery_amount || '')}
                  onChangeText={(v: string) =>
                    updateField('minimum_delivery_amount', parseFloat(v) || 0)
                  }
                  mode="outlined"
                  keyboardType="decimal-pad"
                  dense
                  style={styles.input}
                />
              </>
            )}
          </Card.Content>
        </Card>

        {/* Contact */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Contact
            </Text>
            <TextInput
              label="Phone"
              value={(form.phone as string) || ''}
              onChangeText={(v: string) => updateField('phone', v)}
              mode="outlined"
              keyboardType="phone-pad"
              dense
              style={styles.input}
            />
            <TextInput
              label="Website"
              value={(form.website as string) || ''}
              onChangeText={(v: string) => updateField('website', v)}
              mode="outlined"
              keyboardType="url"
              dense
              style={styles.input}
            />
            <TextInput
              label="Instagram"
              value={(form.instagram_url as string) || ''}
              onChangeText={(v: string) => updateField('instagram_url', v)}
              mode="outlined"
              dense
              style={styles.input}
            />
            <TextInput
              label="WhatsApp"
              value={(form.whatsapp_number as string) || ''}
              onChangeText={(v: string) => updateField('whatsapp_number', v)}
              mode="outlined"
              dense
              style={styles.input}
            />
            <TextInput
              label="Google Maps URL"
              value={(form.google_maps_url as string) || ''}
              onChangeText={(v: string) => updateField('google_maps_url', v)}
              mode="outlined"
              dense
              style={styles.input}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Save/Reset Bar */}
      {hasChanges && (
        <View style={styles.saveBar}>
          <Button mode="outlined" onPress={handleReset}>
            Reset
          </Button>
          <Button mode="contained" onPress={handleSave} loading={updateSettings.isPending}>
            Save Changes
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 80 },
  card: {},
  sectionTitle: { fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  input: { marginBottom: 8 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  saveBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
});
