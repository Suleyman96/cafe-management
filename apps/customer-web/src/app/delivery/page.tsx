'use client';

import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import { MapPin, Phone, Truck, User } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useCafeSettings } from '@/hooks/use-settings';
import { useDeliveryStore } from '@/store/delivery-store';

// Next.js 14 requires a Suspense boundary around any client component
// that calls `useSearchParams()` so the static prerender can bail out
// cleanly. Wrapping at the page level keeps the rest of the form
// component unchanged.
export default function DeliveryPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <DeliveryPageInner />
    </Suspense>
  );
}

function DeliveryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('customer');
  const { data: settings, isLoading } = useCafeSettings();
  const {
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryNotes,
    setCustomerInfo,
    setQrToken,
    qrToken,
  } = useDeliveryStore();

  // Capture the delivery QR token from the landing URL (?token=…) and
  // persist it for the cart screen. The staff-web order route requires
  // this to derive the tenant — without it, the POST is rejected (C1).
  useEffect(() => {
    const tokenFromUrl = searchParams?.get('token');
    if (tokenFromUrl && tokenFromUrl !== qrToken) {
      setQrToken(tokenFromUrl);
    }
  }, [searchParams, qrToken, setQrToken]);

  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState(customerPhone);
  const [address, setAddress] = useState(deliveryAddress);
  const [notes, setNotes] = useState(deliveryNotes);
  const [error, setError] = useState('');

  // Sync local state when store values change (e.g. navigating back to edit)
  useEffect(() => {
    setName(customerName);
    setPhone(customerPhone);
    setAddress(deliveryAddress);
    setNotes(deliveryNotes);
  }, [customerName, customerPhone, deliveryAddress, deliveryNotes]);

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!settings?.delivery_enabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Truck className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">{t('deliveryLanding.unavailableTitle')}</h1>
        <p className="text-muted-foreground">{t('deliveryLanding.unavailableSubtext')}</p>
      </div>
    );
  }

  const handleContinue = () => {
    if (!name.trim()) {
      setError(t('deliveryLanding.errorName'));
      return;
    }
    if (!phone.trim()) {
      setError(t('deliveryLanding.errorPhone'));
      return;
    }
    const phoneRegex = /^[+\d\s\-()]{7,20}$/;
    if (!phoneRegex.test(phone.trim())) {
      setError(t('deliveryLanding.errorPhoneFormat'));
      return;
    }
    if (!address.trim()) {
      setError(t('deliveryLanding.errorAddress'));
      return;
    }
    setError('');
    setCustomerInfo(name.trim(), phone.trim(), address.trim(), notes.trim());
    router.push('/delivery/menu');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto p-6">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Truck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">{t('deliveryLanding.heroTitle')}</h1>
          <p className="text-muted-foreground">{t('deliveryLanding.heroSubtext')}</p>
        </div>

        {/* Delivery zone info */}
        {settings.delivery_zone_info && (
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {settings.delivery_zone_info}
            </p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {t('deliveryLanding.labelName')}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('deliveryLanding.namePlaceholder')}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {t('deliveryLanding.labelPhone')}
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={20}
                placeholder={t('deliveryLanding.phonePlaceholder')}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {t('deliveryLanding.labelAddress')}
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('deliveryLanding.addressPlaceholder')}
                rows={3}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {t('deliveryLanding.labelNotes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('deliveryLanding.notesPlaceholder')}
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <Button size="xl" className="w-full mt-4" onClick={handleContinue}>
            {t('deliveryLanding.browseMenu')}
          </Button>

          {/* Delivery fee info */}
          {(settings.delivery_fee_default ?? 0) > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              {t('deliveryLanding.deliveryFeeInfo', {
                fee: (settings.delivery_fee_default ?? 0).toFixed(2),
                currency: settings.currency_symbol,
                min:
                  (settings.minimum_delivery_amount ?? 0) > 0
                    ? (settings.minimum_delivery_amount ?? 0).toFixed(2)
                    : '0',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
