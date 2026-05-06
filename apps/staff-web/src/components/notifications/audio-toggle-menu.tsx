'use client';

import { useTranslation } from '@gustri/i18n';
import { AlertCircle, Bell, BellOff, BellRing, ClipboardList } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type AudioChannel = 'orders' | 'waiterCalls' | 'alerts';
export type AudioPrefs = Record<AudioChannel, boolean>;

interface AudioToggleMenuProps {
  prefs: AudioPrefs;
  onToggle: (channel: AudioChannel) => void;
}

export function AudioToggleMenu({ prefs, onToggle }: AudioToggleMenuProps) {
  const { t } = useTranslation('staff');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const allOff = !prefs.orders && !prefs.waiterCalls && !prefs.alerts;
  const allOn = prefs.orders && prefs.waiterCalls && prefs.alerts;
  const partial = !allOff && !allOn;

  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const triggerColor = allOff
    ? 'bg-gray-500 hover:bg-gray-600'
    : partial
      ? 'bg-amber-500 hover:bg-amber-600'
      : 'bg-green-500 hover:bg-green-600';

  const triggerLabel = allOff
    ? t('notifications.soundOff')
    : partial
      ? t('notifications.audioPartial')
      : t('notifications.soundOn');

  return (
    <>
      {open && (
        <div
          ref={popoverRef}
          role="menu"
          aria-label={t('notifications.audioSettings')}
          className="fixed bottom-20 right-4 z-50 w-64 rounded-lg bg-white shadow-xl border border-gray-200 p-2"
        >
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {t('notifications.audioSettings')}
          </div>
          <ChannelRow
            label={t('notifications.audioOrders')}
            icon={<ClipboardList className="h-4 w-4" />}
            enabled={prefs.orders}
            onClick={() => onToggle('orders')}
          />
          <ChannelRow
            label={t('notifications.audioWaiterCalls')}
            icon={<BellRing className="h-4 w-4" />}
            enabled={prefs.waiterCalls}
            onClick={() => onToggle('waiterCalls')}
          />
          <ChannelRow
            label={t('notifications.audioAlerts')}
            icon={<AlertCircle className="h-4 w-4" />}
            enabled={prefs.alerts}
            onClick={() => onToggle('alerts')}
          />
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all text-white ${triggerColor}`}
        title={t('notifications.audioSettings')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {allOff ? (
          <BellOff className="h-5 w-5" />
        ) : (
          <Bell className={`h-5 w-5 ${allOn ? 'animate-pulse' : ''}`} />
        )}
        <span className="text-sm font-medium hidden sm:inline">{triggerLabel}</span>
      </button>
    </>
  );
}

function ChannelRow({
  label,
  icon,
  enabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={enabled}
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors"
    >
      <span className="flex items-center gap-2 text-sm text-gray-700">
        <span className="text-gray-500">{icon}</span>
        {label}
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          enabled ? 'bg-green-500' : 'bg-gray-300'
        }`}
        aria-hidden="true"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}
