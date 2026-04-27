'use client';

import { useTranslation } from '@gustri/i18n';
import { MessageSquare, Palette, QrCode } from 'lucide-react';
import type { SettingsTabProps } from '@/types/settings';
import { ColorPicker } from './color-picker';
import { ImageUpload } from './image-upload';

export function BrandingSettingsTab({ formData, onChange }: SettingsTabProps) {
  const { t } = useTranslation('staff');

  return (
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
            onChange={(url) => onChange('cafe_logo_url', url)}
            label={t('cafeSettings.restaurantLogo')}
            hint={t('cafeSettings.logoHint')}
            aspectRatio="square"
            folder="logos"
          />
          <ImageUpload
            value={formData.hero_image_url}
            onChange={(url) => onChange('hero_image_url', url)}
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
            onChange={(color) => onChange('brand_primary_color', color)}
            label={t('cafeSettings.primaryColor')}
          />
          <ColorPicker
            value={formData.brand_secondary_color}
            onChange={(color) => onChange('brand_secondary_color', color)}
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
              onChange={(e) => onChange('welcome_heading', e.target.value || null)}
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
              onChange={(e) => onChange('welcome_message', e.target.value || null)}
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
              onChange={(e) => onChange('qr_ordering_enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
