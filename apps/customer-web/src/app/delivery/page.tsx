'use client';

import { MapPin, Phone, Truck, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useCafeSettings } from '@/hooks/use-settings';
import { useDeliveryStore } from '@/store/delivery-store';

export default function DeliveryPage() {
  const router = useRouter();
  const { data: settings, isLoading } = useCafeSettings();
  const { customerName, customerPhone, deliveryAddress, deliveryNotes, setCustomerInfo } =
    useDeliveryStore();

  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState(customerPhone);
  const [address, setAddress] = useState(deliveryAddress);
  const [notes, setNotes] = useState(deliveryNotes);
  const [error, setError] = useState('');

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!settings?.delivery_enabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Truck className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Delivery Not Available</h1>
        <p className="text-muted-foreground">
          Delivery ordering is currently not available. Please try again later.
        </p>
      </div>
    );
  }

  const handleContinue = () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    if (!address.trim()) {
      setError('Please enter your delivery address');
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
          <h1 className="text-2xl font-bold mb-2">Order for Delivery</h1>
          <p className="text-muted-foreground">Fill in your details and browse our menu</p>
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
            <label className="text-sm font-medium mb-1.5 block">Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Phone *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+994 XX XXX XX XX"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Delivery Address *</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full delivery address"
                rows={3}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Delivery Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Floor number, door code, landmarks..."
              rows={2}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <Button size="xl" className="w-full mt-4" onClick={handleContinue}>
            Browse Menu
          </Button>

          {/* Delivery fee info */}
          {settings.delivery_fee_default > 0 && (
            <p className="text-xs text-center text-muted-foreground">
              Delivery fee: {settings.delivery_fee_default.toFixed(2)} {settings.currency_symbol}
              {settings.minimum_delivery_amount > 0 &&
                ` · Minimum order: ${settings.minimum_delivery_amount.toFixed(2)} ${settings.currency_symbol}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
