'use client';

import { useTranslation } from '@gustri/i18n';
import { Globe, Phone } from 'lucide-react';
import type { SettingsTabProps } from './settings-types';

export function ContactSettingsTab({ formData, onChange }: SettingsTabProps) {
  const { t } = useTranslation('staff');

  return (
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
              onChange={(e) => onChange('contact_phone', e.target.value || null)}
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
              onChange={(e) => onChange('contact_website', e.target.value || null)}
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
          <SocialInput
            label={t('cafeSettings.instagram')}
            value={formData.social_instagram}
            onChange={(v) => onChange('social_instagram', v)}
            placeholder="https://instagram.com/yourrestaurant"
          />
          <SocialInput
            label={t('cafeSettings.whatsapp')}
            value={formData.social_whatsapp}
            onChange={(v) => onChange('social_whatsapp', v)}
            placeholder="https://wa.me/994501234567"
          />
          <SocialInput
            label="TikTok"
            value={formData.social_tiktok}
            onChange={(v) => onChange('social_tiktok', v)}
            placeholder="https://tiktok.com/@yourrestaurant"
          />
          <SocialInput
            label="Telegram"
            value={formData.social_telegram}
            onChange={(v) => onChange('social_telegram', v)}
            placeholder="https://t.me/yourrestaurant"
          />
          <SocialInput
            label="LINE"
            value={formData.social_line}
            onChange={(v) => onChange('social_line', v)}
            placeholder="https://line.me/R/ti/p/@yourrestaurant"
          />
          <SocialInput
            label={t('cafeSettings.googleMaps')}
            value={formData.location_maps_url}
            onChange={(v) => onChange('location_maps_url', v)}
            placeholder="https://g.page/yourrestaurant"
          />
        </div>
      </div>
    </div>
  );
}

function SocialInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="url"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
