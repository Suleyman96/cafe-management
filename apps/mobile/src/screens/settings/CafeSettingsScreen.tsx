import { isAppError } from '@gustri/core';
import type { CafeSettings } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
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
import { OfflineGuardButton } from '@/components/OfflineGuardButton';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCafeSettings, useUpdateCafeSettings } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';

type TabView = 'general' | 'branding' | 'contact';

export default function CafeSettingsScreen() {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const { showSuccess, showError } = useSnackbar();
  const { data: settings, isLoading, error, refetch } = useCafeSettings();
  const updateSettings = useUpdateCafeSettings();

  const [form, setForm] = useState<Partial<CafeSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>('general');
  // Per-field validation errors surfaced from a ValidationError thrown by the mutation.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings && !hasChanges) {
      setForm(settings);
    }
  }, [settings, hasChanges]);

  const updateField = (key: string, value: boolean | string | number | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const { [key]: _omit, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleSave = async () => {
    try {
      setFieldErrors({});
      await updateSettings.mutateAsync(form);
      showSuccess(t('cafeSettings.settingsSaved'));
      setHasChanges(false);
    } catch (err: unknown) {
      if (isAppError(err) && err.code === 'VALIDATION_ERROR') {
        const details = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
        if (details?.fieldErrors) {
          const flat: Record<string, string> = {};
          for (const [field, msgs] of Object.entries(details.fieldErrors)) {
            if (msgs && msgs.length > 0) flat[field] = msgs[0];
          }
          setFieldErrors(flat);
        }
      }
      showError(err instanceof Error ? err : t('cafeSettings.failedSave'));
    }
  };

  const handleReset = () => {
    if (settings) {
      setForm(settings);
      setHasChanges(false);
    }
  };

  if (isLoading) return <LoadingScreen message={t('cafeSettings.loadingSettings')} />;
  if (error) return <ErrorScreen error={error} onRetry={refetch} />;

  return (
    <View style={styles.wrapper}>
      <SegmentedButtons
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabView)}
        buttons={[
          { value: 'general', label: t('cafeSettings.general') },
          { value: 'branding', label: t('cafeSettings.branding') },
          { value: 'contact', label: t('cafeSettings.contact') },
        ]}
        style={styles.tabs}
        density="small"
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {activeTab === 'general' && (
          <>
            <RestaurantInfoSection
              form={form}
              updateField={updateField}
              fieldErrors={fieldErrors}
            />
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
            {tCommon('reset')}
          </Button>
          <OfflineGuardButton
            mode="contained"
            onPress={handleSave}
            loading={updateSettings.isPending}
            offlineLabel={t('cafeSettings.offlineUnavailable')}
          >
            {tCommon('saveChanges')}
          </OfflineGuardButton>
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
