'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { MapPin, Phone, StickyNote, Truck, User, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCafeSettings, useCreateOrder } from '@/hooks';
import { formatPriceWithSettings } from '@/hooks/use-settings-safe';

interface CreateDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
}

export function CreateDeliveryModal({ isOpen, onClose, onSuccess }: CreateDeliveryModalProps) {
  const { t } = useTranslation('staff');
  const createOrder = useCreateOrder();
  const { data: settings } = useCafeSettings();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(settings?.delivery_fee_default?.toString() || '0');
  const [loading, setLoading] = useState(false);

  const formatPrice = (amount: number) => {
    if (settings) return formatPriceWithSettings(amount, settings);
    return `$${amount.toFixed(2)}`;
  };

  const handleCreate = async () => {
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) return;

    setLoading(true);
    try {
      const result = await createOrder.mutateAsync({
        order_type: 'delivery',
        status: 'new',
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        delivery_notes: deliveryNotes.trim() || null,
        delivery_fee: Number.parseFloat(deliveryFee) || 0,
      } as any);
      onSuccess(result.id);

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setDeliveryNotes('');
      setDeliveryFee(settings?.delivery_fee_default?.toString() || '0');
    } catch (error) {
      console.error('Failed to create delivery order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isValid = customerName.trim() && customerPhone.trim() && deliveryAddress.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-bold">{t('delivery.createDeliveryOrder')}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline h-4 w-4 mr-1" />
              {t('delivery.customerName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={t('delivery.customerName')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="inline h-4 w-4 mr-1" />
              {t('delivery.phoneNumber')} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="+994 50 123 4567"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPin className="inline h-4 w-4 mr-1" />
              {t('delivery.deliveryAddress')} <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              placeholder={t('delivery.fullDeliveryAddress')}
              rows={2}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <StickyNote className="inline h-4 w-4 mr-1" />
              {t('delivery.deliveryNotes')}
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              placeholder={t('delivery.ringDoorbell')}
              rows={2}
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Truck className="inline h-4 w-4 mr-1" />
              {t('delivery.deliveryFee')}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
            />
            {settings?.delivery_fee_default ? (
              <p className="text-xs text-gray-500 mt-1">
                Default: {formatPrice(settings.delivery_fee_default)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-purple-800">{t('delivery.deliveryHint')}</p>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || loading}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {loading
              ? `${t('delivery.createDeliveryOrder')}...`
              : t('delivery.createDeliveryOrder')}
          </Button>
        </div>
      </div>
    </div>
  );
}
