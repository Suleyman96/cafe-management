'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import {
  ClipboardList,
  DollarSign,
  Globe,
  MessageSquare,
  Palette,
  Phone,
  QrCode,
  Receipt,
  RotateCcw,
  Save,
  Store,
  Truck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ColorPicker } from '@/components/settings/color-picker';
import { ImageUpload } from '@/components/settings/image-upload';
import { useCafeSettings, useUpdateCafeSettings } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';

export default function CafeSettingsPage() {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const { data: settings, isLoading } = useCafeSettings();
  const updateSettings = useUpdateCafeSettings();

  // Local form state - includes all new branding fields
  const [formData, setFormData] = useState({
    // Basic info
    restaurant_name: '',
    // Tax settings
    tax_enabled: true,
    tax_percentage: 18,
    tax_label: 'Tax',
    prices_include_tax: false,
    show_tax_separately: true,
    // Currency settings
    currency_symbol: '₼',
    currency_code: 'AZN',
    currency_position: 'after' as 'before' | 'after',
    currency_decimal_places: 2,
    // Order settings
    minimum_order_amount: 0,
    allow_item_notes: true,
    allow_order_notes: true,
    // Branding
    cafe_logo_url: null as string | null,
    hero_image_url: null as string | null,
    brand_primary_color: '#3B82F6',
    brand_secondary_color: '#1E40AF',
    // Welcome screen
    welcome_heading: null as string | null,
    welcome_message: null as string | null,
    // Feature controls
    qr_ordering_enabled: true,
    tips_enabled: false,
    waste_tracking_enabled: false,
    // Delivery settings
    delivery_enabled: false,
    delivery_fee_default: 0,
    minimum_delivery_amount: 0,
    delivery_zone_info: null as string | null,
    // Contact & social
    contact_phone: null as string | null,
    contact_website: null as string | null,
    social_instagram: null as string | null,
    social_whatsapp: null as string | null,
    social_tiktok: null as string | null,
    social_telegram: null as string | null,
    social_line: null as string | null,
    location_maps_url: null as string | null,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'contact'>('general');

  // Sync form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        restaurant_name: settings.restaurant_name,
        tax_enabled: settings.tax_enabled,
        tax_percentage: settings.tax_percentage,
        tax_label: settings.tax_label,
        prices_include_tax: settings.prices_include_tax,
        show_tax_separately: settings.show_tax_separately,
        currency_symbol: settings.currency_symbol,
        currency_code: settings.currency_code,
        currency_position: settings.currency_position,
        currency_decimal_places: settings.currency_decimal_places,
        minimum_order_amount: settings.minimum_order_amount,
        allow_item_notes: settings.allow_item_notes,
        allow_order_notes: settings.allow_order_notes,
        cafe_logo_url: settings.cafe_logo_url,
        hero_image_url: settings.hero_image_url,
        brand_primary_color: settings.brand_primary_color || '#3B82F6',
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
        tax_enabled: settings.tax_enabled,
        tax_percentage: settings.tax_percentage,
        tax_label: settings.tax_label,
        prices_include_tax: settings.prices_include_tax,
        show_tax_separately: settings.show_tax_separately,
        currency_symbol: settings.currency_symbol,
        currency_code: settings.currency_code,
        currency_position: settings.currency_position,
        currency_decimal_places: settings.currency_decimal_places,
        minimum_order_amount: settings.minimum_order_amount,
        allow_item_notes: settings.allow_item_notes,
        allow_order_notes: settings.allow_order_notes,
        cafe_logo_url: settings.cafe_logo_url,
        hero_image_url: settings.hero_image_url,
        brand_primary_color: settings.brand_primary_color || '#3B82F6',
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

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Restaurant Info */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Store className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.restaurantInformation')}</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.restaurantName')}
                </label>
                <input
                  type="text"
                  value={formData.restaurant_name}
                  onChange={(e) => handleChange('restaurant_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Tax Settings */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.taxSettings')}</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('cafeSettings.enableTax')}
                  </label>
                  <p className="text-xs text-gray-500">{t('cafeSettings.turnOnTax')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.tax_enabled}
                    onChange={(e) => handleChange('tax_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {formData.tax_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('cafeSettings.taxPercentage')}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.tax_percentage}
                          onChange={(e) =>
                            handleChange('tax_percentage', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="absolute right-3 top-2 text-gray-500">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('cafeSettings.taxLabel')}
                      </label>
                      <input
                        type="text"
                        value={formData.tax_label}
                        onChange={(e) => handleChange('tax_label', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {t('cafeSettings.pricesIncludeTax')}
                      </label>
                      <p className="text-xs text-gray-500">
                        {t('cafeSettings.menuPricesTaxIncluded')}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.prices_include_tax}
                        onChange={(e) => handleChange('prices_include_tax', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        {t('cafeSettings.showTaxSeparately')}
                      </label>
                      <p className="text-xs text-gray-500">{t('cafeSettings.displayTaxLine')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.show_tax_separately}
                        onChange={(e) => handleChange('show_tax_separately', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Currency Settings */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.currencySettings')}</h2>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('cafeSettings.currencySymbol')}
                  </label>
                  <input
                    type="text"
                    value={formData.currency_symbol}
                    onChange={(e) => handleChange('currency_symbol', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('cafeSettings.currencyCode')}
                  </label>
                  <input
                    type="text"
                    value={formData.currency_code}
                    onChange={(e) => handleChange('currency_code', e.target.value.toUpperCase())}
                    maxLength={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('cafeSettings.symbolPosition')}
                  </label>
                  <select
                    value={formData.currency_position}
                    onChange={(e) => handleChange('currency_position', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="before">{t('cafeSettings.before')}</option>
                    <option value="after">{t('cafeSettings.after')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('cafeSettings.decimalPlaces')}
                  </label>
                  <select
                    value={formData.currency_decimal_places}
                    onChange={(e) =>
                      handleChange('currency_decimal_places', parseInt(e.target.value, 10))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={0}>0 (10)</option>
                    <option value={1}>1 (10.5)</option>
                    <option value={2}>2 (10.50)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Order Settings */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.orderSettings')}</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.minimumOrderAmount')}
                </label>
                <div className="relative w-48">
                  <span className="absolute left-3 top-2 text-gray-500">
                    {formData.currency_symbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minimum_order_amount}
                    onChange={(e) =>
                      handleChange('minimum_order_amount', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('cafeSettings.allowItemNotes')}
                  </label>
                  <p className="text-xs text-gray-500">{t('cafeSettings.customersNotesItems')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_item_notes}
                    onChange={(e) => handleChange('allow_item_notes', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('cafeSettings.allowOrderNotes')}
                  </label>
                  <p className="text-xs text-gray-500">{t('cafeSettings.customersNotesOrders')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_order_notes}
                    onChange={(e) => handleChange('allow_order_notes', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('cafeSettings.enableTips')}
                  </label>
                  <p className="text-xs text-gray-500">{t('cafeSettings.allowStaffTips')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.tips_enabled}
                    onChange={(e) => handleChange('tips_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('cafeSettings.wasteTracking')}
                  </label>
                  <p className="text-xs text-gray-500">{t('cafeSettings.trackFoodWaste')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.waste_tracking_enabled}
                    onChange={(e) => handleChange('waste_tracking_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
          {/* Delivery Settings */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.deliverySettings')}</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {t('cafeSettings.enableDelivery')}
                  </label>
                  <p className="text-xs text-gray-500">{t('cafeSettings.allowDeliveryOrders')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.delivery_enabled}
                    onChange={(e) => handleChange('delivery_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {formData.delivery_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('cafeSettings.defaultDeliveryFee')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">
                          {formData.currency_symbol}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.delivery_fee_default}
                          onChange={(e) =>
                            handleChange('delivery_fee_default', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('cafeSettings.minimumDeliveryAmount')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-gray-500">
                          {formData.currency_symbol}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.minimum_delivery_amount}
                          onChange={(e) =>
                            handleChange('minimum_delivery_amount', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 pl-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('cafeSettings.deliveryZoneInfo')}
                    </label>
                    <p className="text-xs text-gray-500 mb-1">
                      {t('cafeSettings.deliveryZoneDescribe')}
                    </p>
                    <textarea
                      value={formData.delivery_zone_info || ''}
                      onChange={(e) => handleChange('delivery_zone_info', e.target.value || null)}
                      placeholder={t('cafeSettings.deliveryZonePlaceholder')}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div className="space-y-6">
          {/* Logo & Images */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.logoImages')}</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <ImageUpload
                value={formData.cafe_logo_url}
                onChange={(url) => handleChange('cafe_logo_url', url)}
                label={t('cafeSettings.restaurantLogo')}
                hint={t('cafeSettings.logoHint')}
                aspectRatio="square"
                folder="logos"
              />
              <ImageUpload
                value={formData.hero_image_url}
                onChange={(url) => handleChange('hero_image_url', url)}
                label={t('cafeSettings.heroBackground')}
                hint={t('cafeSettings.heroHint')}
                aspectRatio="wide"
                folder="backgrounds"
              />
            </div>
          </div>

          {/* Brand Colors */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg font-semibold mb-4">{t('cafeSettings.brandColors')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('cafeSettings.colorsInfo')}</p>
            <div className="grid sm:grid-cols-2 gap-6">
              <ColorPicker
                value={formData.brand_primary_color}
                onChange={(color) => handleChange('brand_primary_color', color)}
                label={t('cafeSettings.primaryColor')}
              />
              <ColorPicker
                value={formData.brand_secondary_color}
                onChange={(color) => handleChange('brand_secondary_color', color)}
                label={t('cafeSettings.secondaryColor')}
              />
            </div>
          </div>

          {/* Welcome Screen */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.welcomeScreen')}</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">{t('cafeSettings.customizeWelcome')}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.welcomeHeading')}
                </label>
                <input
                  type="text"
                  value={formData.welcome_heading || ''}
                  onChange={(e) => handleChange('welcome_heading', e.target.value || null)}
                  placeholder={t('cafeSettings.welcomeHeadingPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.welcomeMessage')}
                </label>
                <textarea
                  value={formData.welcome_message || ''}
                  onChange={(e) => handleChange('welcome_message', e.target.value || null)}
                  placeholder={t('cafeSettings.welcomeMessagePlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* QR Menu Settings */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.qrMenuFeatures')}</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  {t('cafeSettings.enableQrOrdering')}
                </label>
                <p className="text-xs text-gray-500">{t('cafeSettings.qrOrderingInfo')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.qr_ordering_enabled}
                  onChange={(e) => handleChange('qr_ordering_enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Contact Tab */}
      {activeTab === 'contact' && (
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.contactInformation')}</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">{t('cafeSettings.contactInfo')}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.phoneNumber')}
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone || ''}
                  onChange={(e) => handleChange('contact_phone', e.target.value || null)}
                  placeholder="+994 50 123 45 67"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.website')}
                </label>
                <input
                  type="url"
                  value={formData.contact_website || ''}
                  onChange={(e) => handleChange('contact_website', e.target.value || null)}
                  placeholder="https://yourrestaurant.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold">{t('cafeSettings.socialMedia')}</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.instagram')}
                </label>
                <input
                  type="url"
                  value={formData.social_instagram || ''}
                  onChange={(e) => handleChange('social_instagram', e.target.value || null)}
                  placeholder="https://instagram.com/yourrestaurant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.whatsapp')}
                </label>
                <input
                  type="url"
                  value={formData.social_whatsapp || ''}
                  onChange={(e) => handleChange('social_whatsapp', e.target.value || null)}
                  placeholder="https://wa.me/994501234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TikTok</label>
                <input
                  type="url"
                  value={formData.social_tiktok || ''}
                  onChange={(e) => handleChange('social_tiktok', e.target.value || null)}
                  placeholder="https://tiktok.com/@yourrestaurant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telegram</label>
                <input
                  type="url"
                  value={formData.social_telegram || ''}
                  onChange={(e) => handleChange('social_telegram', e.target.value || null)}
                  placeholder="https://t.me/yourrestaurant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LINE</label>
                <input
                  type="url"
                  value={formData.social_line || ''}
                  onChange={(e) => handleChange('social_line', e.target.value || null)}
                  placeholder="https://line.me/R/ti/p/@yourrestaurant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.googleMaps')}
                </label>
                <input
                  type="url"
                  value={formData.location_maps_url || ''}
                  onChange={(e) => handleChange('location_maps_url', e.target.value || null)}
                  placeholder="https://g.page/yourrestaurant"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
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
