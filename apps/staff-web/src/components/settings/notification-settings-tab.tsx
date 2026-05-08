'use client';

import { useTranslation } from '@gustri/i18n';
import { AlertCircle, Bell, BellRing, ClipboardList } from 'lucide-react';
import { type AudioChannel, useAudioPrefs } from '@/components/providers/notification-provider';

export function NotificationSettingsTab() {
  const { t } = useTranslation('staff');
  const { prefs, toggleChannel } = useAudioPrefs();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold">{t('cafeSettings.notificationSounds')}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t('cafeSettings.notificationSoundsHint')}</p>
        <div className="space-y-1">
          <ChannelRow
            label={t('notifications.audioOrders')}
            description={t('cafeSettings.audioOrdersHint')}
            icon={<ClipboardList className="h-4 w-4" />}
            enabled={prefs.orders}
            onClick={() => toggleChannel('orders')}
            channel="orders"
          />
          <ChannelRow
            label={t('notifications.audioWaiterCalls')}
            description={t('cafeSettings.audioWaiterCallsHint')}
            icon={<BellRing className="h-4 w-4" />}
            enabled={prefs.waiterCalls}
            onClick={() => toggleChannel('waiterCalls')}
            channel="waiterCalls"
          />
          <ChannelRow
            label={t('notifications.audioAlerts')}
            description={t('cafeSettings.audioAlertsHint')}
            icon={<AlertCircle className="h-4 w-4" />}
            enabled={prefs.alerts}
            onClick={() => toggleChannel('alerts')}
            channel="alerts"
          />
        </div>
      </div>
    </div>
  );
}

function ChannelRow({
  label,
  description,
  icon,
  enabled,
  onClick,
  channel,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  onClick: () => void;
  channel: AudioChannel;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-gray-500 mt-0.5">{icon}</span>
        <div className="min-w-0">
          <label
            htmlFor={`audio-toggle-${channel}`}
            className="block text-sm font-medium text-gray-700"
          >
            {label}
          </label>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          id={`audio-toggle-${channel}`}
          type="checkbox"
          role="switch"
          aria-checked={enabled}
          checked={enabled}
          onChange={onClick}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );
}
