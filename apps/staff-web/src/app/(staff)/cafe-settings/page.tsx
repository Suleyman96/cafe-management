'use client';

import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import { Palette, Phone, RotateCcw, Save, Store } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BrandingSettingsTab } from '@/components/settings/branding-settings-tab';
import { ContactSettingsTab } from '@/components/settings/contact-settings-tab';
import { GeneralSettingsTab } from '@/components/settings/general-settings-tab';
import type { CafeSettingsFormData } from '@/components/settings/settings-types';
import { useCafeSettings, useUpdateCafeSettings } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';

export default function CafeSettingsPage() {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const { data: settings, isLoading } = useCafeSettings();
  const updateSettings = useUpdateCafeSettings();

  // Local form state - includes all new branding fields
  const [formData, setFormData] = useState<CafeSettingsFormData>({
    restaurant_name: '',
    restaurant_address: null,
    tax_enabled: true,
    tax_percentage: 18,
    tax_label: 'Tax',
    currency_symbol: '₼',
    currency_code: 'AZN',
    currency_position: 'after',
    currency_decimal_places: 2,
    minimum_order_amount: 0,
    allow_item_notes: true,
    allow_order_notes: true,
    cafe_logo_url: null,
    hero_image_url: null,
    brand_primary_color: '#367B8B',
    brand_secondary_color: '#1E40AF',
    welcome_heading: null,
    welcome_message: null,
    qr_ordering_enabled: true,
    tips_enabled: false,
    waste_tracking_enabled: false,
    delivery_enabled: false,
    delivery_fee_default: 0,
    minimum_delivery_amount: 0,
    delivery_zone_info: null,
    contact_phone: null,
    contact_website: null,
    social_instagram: null,
    social_whatsapp: null,
    social_tiktok: null,
    social_telegram: null,
    social_line: null,
    location_maps_url: null,
    default_language: 'en',
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'contact'>('general');

  // Sync form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        restaurant_name: settings.restaurant_name,
        restaurant_address: settings.restaurant_address ?? null,
        tax_enabled: settings.tax_enabled,
        tax_percentage: settings.tax_percentage,
        tax_label: settings.tax_label,
        currency_symbol: settings.currency_symbol,
        currency_code: settings.currency_code,
        currency_position: settings.currency_position,
        currency_decimal_places: settings.currency_decimal_places,
        minimum_order_amount: settings.minimum_order_amount,
        allow_item_notes: settings.allow_item_notes,
        allow_order_notes: settings.allow_order_notes,
        cafe_logo_url: settings.cafe_logo_url,
        hero_image_url: settings.hero_image_url,
        brand_primary_color: settings.brand_primary_color || '#367B8B',
        brand_secondary_color: settings.brand_secondary_color || '#1E40AF',
        welcome_heading: settings.welcome_heading,
        welcome_message: settings.welcome_message,
        qr_ordering_enabled: settings.qr_ordering_enabled,
        tips_enabled: settings.tips_enabled ?? false,
        waste_tracking_enabled: settings.waste_tracking_enabled ?? false,
        delivery_enabled: settings.delivery_enabled ?? false,
        delivery_fee_default: settings.delivery_fee_default ?? 0,
        minimum_delivery_amount: settings.minimum_delivery_amount ?? 0,
        delivery_zone_info: settings.delivery_zone_info ?? null,
        contact_phone: settings.contact_phone,
        contact_website: settings.contact_website,
        social_instagram: settings.social_instagram,
        social_whatsapp: settings.social_whatsapp,
        social_tiktok: settings.social_tiktok,
        social_telegram: settings.social_telegram,
        social_line: settings.social_line,
        location_maps_url: settings.location_maps_url,
        default_language: settings.default_language ?? 'en',
      });
      setHasChanges(false);
    }
  }, [settings]);

  // Check if user is admin
  if (staff?.role !== 'admin' && staff?.role !== 'owner') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{t('cafeSettings.noPermission')}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const handleChange = (field: string, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(formData);
      toast.success(t('cafeSettings.settingsSaved'));
      setHasChanges(false);
    } catch (_error) {
      toast.error(t('cafeSettings.failedSave'));
    }
  };

  const handleReset = () => {
    if (settings) {
      setFormData({
        restaurant_name: settings.restaurant_name,
        restaurant_address: settings.restaurant_address ?? null,
        tax_enabled: settings.tax_enabled,
        tax_percentage: settings.tax_percentage,
        tax_label: settings.tax_label,
        currency_symbol: settings.currency_symbol,
        currency_code: settings.currency_code,
        currency_position: settings.currency_position,
        currency_decimal_places: settings.currency_decimal_places,
        minimum_order_amount: settings.minimum_order_amount,
        allow_item_notes: settings.allow_item_notes,
        allow_order_notes: settings.allow_order_notes,
        cafe_logo_url: settings.cafe_logo_url,
        hero_image_url: settings.hero_image_url,
        brand_primary_color: settings.brand_primary_color || '#367B8B',
        brand_secondary_color: settings.brand_secondary_color || '#1E40AF',
        welcome_heading: settings.welcome_heading,
        welcome_message: settings.welcome_message,
        qr_ordering_enabled: settings.qr_ordering_enabled,
        tips_enabled: settings.tips_enabled ?? false,
        waste_tracking_enabled: settings.waste_tracking_enabled ?? false,
        delivery_enabled: settings.delivery_enabled ?? false,
        delivery_fee_default: settings.delivery_fee_default ?? 0,
        minimum_delivery_amount: settings.minimum_delivery_amount ?? 0,
        delivery_zone_info: settings.delivery_zone_info ?? null,
        contact_phone: settings.contact_phone,
        contact_website: settings.contact_website,
        social_instagram: settings.social_instagram,
        social_whatsapp: settings.social_whatsapp,
        social_tiktok: settings.social_tiktok,
        social_telegram: settings.social_telegram,
        social_line: settings.social_line,
        location_maps_url: settings.location_maps_url,
        default_language: settings.default_language ?? 'en',
      });
      setHasChanges(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Store },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'contact', label: 'Contact', icon: Phone },
  ] as const;

  return (
    <div className="p-3 sm:p-6 max-w-4xl pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">{t('cafeSettings.title')}</h1>
        {hasChanges && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={updateSettings.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {t('reset', { ns: 'common' })}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateSettings.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateSettings.isPending
                ? t('saving', { ns: 'common' })
                : t('saveChanges', { ns: 'common' })}
            </Button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && (
        <GeneralSettingsTab formData={formData} onChange={handleChange} />
      )}
      {activeTab === 'branding' && (
        <BrandingSettingsTab formData={formData} onChange={handleChange} />
      )}
      {activeTab === 'contact' && (
        <ContactSettingsTab formData={formData} onChange={handleChange} />
      )}

      {/* Save button at bottom for mobile */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t sm:hidden z-50">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReset}
              disabled={updateSettings.isPending}
            >
              {t('reset', { ns: 'common' })}
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={updateSettings.isPending}>
              {updateSettings.isPending
                ? t('saving', { ns: 'common' })
                : t('saveChanges', { ns: 'common' })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
