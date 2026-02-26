'use client';

import type { MenuItem } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { Button } from '@cafe-idare/ui';
import { useState } from 'react';
import { formatPriceWithSettings, useCafeSettings } from '@/hooks';
import { supabase } from '@/lib/supabase/client';

interface CreateTakeoutModalProps {
  staffId: string;
  menuItems: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}

interface SelectedItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

export function CreateTakeoutModal({
  staffId,
  menuItems,
  isOpen,
  onClose,
  onSuccess,
}: CreateTakeoutModalProps) {
  const { t } = useTranslation('staff');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: cafeSettings } = useCafeSettings();

  // Filter menu items by search
  const filteredItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const addItem = (menuItem: MenuItem) => {
    const existing = selectedItems.find((item) => item.menuItem.id === menuItem.id);

    if (existing) {
      setSelectedItems((prev) =>
        prev.map((item) =>
          item.menuItem.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      );
    } else {
      setSelectedItems((prev) => [...prev, { menuItem, quantity: 1, notes: '' }]);
    }
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems((prev) => prev.filter((item) => item.menuItem.id !== menuItemId));
    } else {
      setSelectedItems((prev) =>
        prev.map((item) => (item.menuItem.id === menuItemId ? { ...item, quantity } : item)),
      );
    }
  };

  const updateNotes = (menuItemId: string, notes: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.menuItem.id === menuItemId ? { ...item, notes } : item)),
    );
  };

  const calculateTotal = () => {
    const subtotal = selectedItems.reduce(
      (sum, item) => sum + item.menuItem.price * item.quantity,
      0,
    );
    const tax = subtotal * 0.18;
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      alert(t('orders.enterNameAndPhone'));
      return;
    }

    if (selectedItems.length === 0) {
      alert(t('orders.addAtLeastOneItem'));
      return;
    }

    setIsSubmitting(true);

    try {
      const { subtotal, tax, total } = calculateTotal();

      // Create takeout order
      const orderResponse = (await supabase
        .from('orders')
        .insert({
          table_id: null, // No table for takeout
          order_type: 'takeout',
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_notes: customerNotes.trim() || null,
          assigned_waiter_id: staffId,
          status: 'new',
          subtotal,
          tax,
          total,
        } as any)
        .select('id')
        .single()) as { data: { id: string } | null; error: any };

      if (orderResponse.error) throw orderResponse.error;
      if (!orderResponse.data || !orderResponse.data.id) {
        throw new Error('Failed to create order');
      }

      const orderId = orderResponse.data.id;

      // Add order items
      const orderItems = selectedItems.map((item) => ({
        order_id: orderId,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        item_price: item.menuItem.price,
        quantity: item.quantity,
        notes: item.notes || null,
        status: 'pending',
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems as any);

      if (itemsError) throw itemsError;

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerNotes('');
      setSelectedItems([]);
      setSearchQuery('');

      onSuccess?.(orderId);
      onClose();
    } catch (error) {
      console.error('Error creating takeout order:', error);
      alert(t('orders.failedCreateTakeout'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const { subtotal, tax, total } = calculateTotal();

  const formatPrice = (price: number) => {
    if (cafeSettings) {
      return formatPriceWithSettings(price, cafeSettings);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AZN',
    }).format(price);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{t('orders.createTakeoutOrder')}</h2>
              <p className="text-sm text-gray-600">{t('orders.forPhoneOrCounter')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Customer Info & Menu */}
            <div className="space-y-6">
              {/* Customer Information */}
              <div>
                <h3 className="font-semibold text-lg mb-4">{t('orders.customerInformation')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('orders.customerNameLabel')} *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t('orders.fullNamePlaceholder')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('orders.phoneNumberLabel')} *
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+994 XX XXX XX XX"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('orders.customerNotesLabel')}
                    </label>
                    <textarea
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      placeholder={t('orders.specialRequestsPlaceholder')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Menu Items Selection */}
              <div>
                <h3 className="font-semibold text-lg mb-4">{t('orders.addItems')}</h3>

                {/* Search */}
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('orders.searchMenuItems')}
                  className="w-full px-4 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* Menu Items List */}
                <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      disabled={!item.is_available}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                        item.is_available
                          ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                          : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        {!item.is_available && (
                          <div className="text-xs text-red-600">{t('orders.unavailable')}</div>
                        )}
                      </div>
                      <div className="font-semibold">{formatPrice(item.price)}</div>
                    </button>
                  ))}

                  {filteredItems.length === 0 && (
                    <div className="text-center py-8 text-gray-500">{t('orders.noItemsFound')}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Selected Items & Summary */}
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-4">
                  {t('orders.selectedItems')} ({selectedItems.length})
                </h3>

                {selectedItems.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">{t('orders.noItemsAddedYet')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('orders.selectFromMenu')}</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {selectedItems.map((item) => (
                      <div key={item.menuItem.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium">{item.menuItem.name}</div>
                            <div className="text-sm text-gray-600">
                              {formatPrice(item.menuItem.price)} {t('each', { ns: 'common' })}
                            </div>
                          </div>
                          <button
                            onClick={() => updateQuantity(item.menuItem.id, 0)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3 mb-2">
                          <button
                            onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-200"
                          >
                            −
                          </button>
                          <span className="font-semibold w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-200"
                          >
                            +
                          </button>
                          <span className="ml-auto font-semibold">
                            {formatPrice(item.menuItem.price * item.quantity)}
                          </span>
                        </div>

                        {/* Notes */}
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateNotes(item.menuItem.id, e.target.value)}
                          placeholder={t('orders.specialRequestsShort')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                          maxLength={200}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Summary */}
              {selectedItems.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold mb-3">{t('orders.orderSummary')}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('subtotal', { ns: 'common' })}:</span>
                      <span className="font-medium">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {t('orders.taxPercent', { percent: '18' })}:
                      </span>
                      <span className="font-medium">{formatPrice(tax)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="font-semibold text-gray-900">
                        {t('total', { ns: 'common' })}:
                      </span>
                      <span className="font-bold text-lg">{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t">
            <Button onClick={onClose} variant="outline" className="flex-1" disabled={isSubmitting}>
              {t('cancel', { ns: 'common' })}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !customerName.trim() ||
                !customerPhone.trim() ||
                selectedItems.length === 0
              }
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isSubmitting
                ? t('orders.creating')
                : `${t('orders.createOrder')} · ${formatPrice(total)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
