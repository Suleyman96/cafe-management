'use client';

import { LANGUAGES, useTranslation } from '@gustri/i18n';
import { ClipboardList, DollarSign, Receipt, Store, Truck } from 'lucide-react';
import { NumberInput } from '@/components/ui/number-input';
import type { SettingsTabProps } from './settings-types';

export function GeneralSettingsTab({ formData, onChange }: SettingsTabProps) {
  const { t } = useTranslation('staff');

  return (
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
              onChange={(e) => onChange('restaurant_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Restaurant Address
            </label>
            <input
              type="text"
              value={formData.restaurant_address || ''}
              onChange={(e) => onChange('restaurant_address', e.target.value || null)}
              placeholder="123 Main Street, City, Country"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Menu Language
            </label>
            <p className="text-xs text-gray-500 mb-1">
              Language shown to customers when they first scan the QR code
            </p>
            <select
              value={formData.default_language}
              onChange={(e) => onChange('default_language', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
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
                onChange={(e) => onChange('tax_enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {formData.tax_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.taxPercentage')}
                </label>
                <NumberInput
                  value={formData.tax_percentage}
                  onChange={(v) => onChange('tax_percentage', parseFloat(v) || 0)}
                  min={0}
                  max={100}
                  step={0.1}
                  suffix="%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('cafeSettings.taxLabel')}
                </label>
                <input
                  type="text"
                  value={formData.tax_label}
                  onChange={(e) => onChange('tax_label', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
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
                onChange={(e) => onChange('currency_symbol', e.target.value)}
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
                onChange={(e) => onChange('currency_code', e.target.value.toUpperCase())}
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
                onChange={(e) => onChange('currency_position', e.target.value)}
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
                onChange={(e) => onChange('currency_decimal_places', parseInt(e.target.value, 10))}
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
            <NumberInput
              value={formData.minimum_order_amount}
              onChange={(v) => onChange('minimum_order_amount', parseFloat(v) || 0)}
              min={0}
              step={0.01}
              prefix={formData.currency_symbol}
              className="w-48"
            />
          </div>
          <ToggleSetting
            label={t('cafeSettings.allowItemNotes')}
            description={t('cafeSettings.customersNotesItems')}
            checked={formData.allow_item_notes}
            onChange={(v) => onChange('allow_item_notes', v)}
          />
          <ToggleSetting
            label={t('cafeSettings.allowOrderNotes')}
            description={t('cafeSettings.customersNotesOrders')}
            checked={formData.allow_order_notes}
            onChange={(v) => onChange('allow_order_notes', v)}
          />
          <ToggleSetting
            label={t('cafeSettings.enableTips')}
            description={t('cafeSettings.allowStaffTips')}
            checked={formData.tips_enabled}
            onChange={(v) => onChange('tips_enabled', v)}
          />
          <ToggleSetting
            label={t('cafeSettings.wasteTracking')}
            description={t('cafeSettings.trackFoodWaste')}
            checked={formData.waste_tracking_enabled}
            onChange={(v) => onChange('waste_tracking_enabled', v)}
          />
        </div>
      </div>

      {/* Delivery Settings */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Truck className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">{t('cafeSettings.deliverySettings')}</h2>
        </div>
        <div className="space-y-4">
          <ToggleSetting
            label={t('cafeSettings.enableDelivery')}
            description={t('cafeSettings.allowDeliveryOrders')}
            checked={formData.delivery_enabled}
            onChange={(v) => onChange('delivery_enabled', v)}
          />

          {formData.delivery_enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('cafeSettings.defaultDeliveryFee')}
                  </label>
                  <NumberInput
                    value={formData.delivery_fee_default}
                    onChange={(v) => onChange('delivery_fee_default', parseFloat(v) || 0)}
                    min={0}
                    step={0.01}
                    prefix={formData.currency_symbol}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('cafeSettings.minimumDeliveryAmount')}
                  </label>
                  <NumberInput
                    value={formData.minimum_delivery_amount}
                    onChange={(v) => onChange('minimum_delivery_amount', parseFloat(v) || 0)}
                    min={0}
                    step={0.01}
                    prefix={formData.currency_symbol}
                  />
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
                  onChange={(e) => onChange('delivery_zone_info', e.target.value || null)}
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
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );
}
