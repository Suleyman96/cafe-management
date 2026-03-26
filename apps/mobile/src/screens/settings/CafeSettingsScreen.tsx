import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, SegmentedButtons } from 'react-native-paper';
import {
  BrandingSection,
  ContactInfoSection,
  CurrencySection,
  DeliverySection,
  OrderSettingsSection,
  RestaurantInfoSection,
  SocialMediaSection,
  TaxSettingsSection,
} from '@/components/cafe-settings';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCafeSettings, useUpdateCafeSettings } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';

type TabView = 'general' | 'branding' | 'contact';

export default function CafeSettingsScreen() {
  const { showSuccess, showError } = useSnackbar();
  const { data: settings, isLoading, error, refetch } = useCafeSettings();
  const updateSettings = useUpdateCafeSettings();

  const [form, setForm] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('general');

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(form);
      showSuccess('Settings saved');
      setHasChanges(false);
    } catch (err: any) {
      showError(err?.message || 'Failed to save settings');
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
      <SegmentedButtons
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabView)}
        buttons={[
          { value: 'general', label: 'General' },
          { value: 'branding', label: 'Branding' },
          { value: 'contact', label: 'Contact' },
        ]}
        style={styles.tabs}
        density="small"
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activeTab === 'general' && (
          <>
            <RestaurantInfoSection form={form} updateField={updateField} />
            <TaxSettingsSection form={form} updateField={updateField} />
            <CurrencySection form={form} updateField={updateField} />
            <OrderSettingsSection form={form} updateField={updateField} />
            <DeliverySection form={form} updateField={updateField} />
          </>
        )}

        {activeTab === 'branding' && <BrandingSection form={form} updateField={updateField} />}

        {activeTab === 'contact' && (
          <>
            <ContactInfoSection form={form} updateField={updateField} />
            <SocialMediaSection form={form} updateField={updateField} />
          </>
        )}
      </ScrollView>

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
  tabs: { marginHorizontal: 16, marginTop: 8, marginBottom: 8 },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 80 },
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
