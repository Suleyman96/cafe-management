'use client';

import type { MenuItem, OrdersInsert } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button, NumberInput } from '@gustri/ui';
import { Map as MapIcon, MapPin, Phone, Search, StickyNote, Truck, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  useAddOrderItems,
  useCafeSettings,
  useCreateDeliveryCustomer,
  useCreateOrder,
  useIncrementDeliveryCustomerOrderCount,
  useSearchDeliveryCustomers,
  useTaxMultiplier,
} from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';

interface CreateDeliveryModalProps {
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

export function CreateDeliveryModal({
  staffId,
  menuItems,
  isOpen,
  onClose,
  onSuccess,
}: CreateDeliveryModalProps) {
  const { t } = useTranslation('staff');
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();
  const { data: settings } = useCafeSettings();
  const formatPrice = useFormatPrice();
  const taxMultiplier = useTaxMultiplier();
  const createDeliveryCustomer = useCreateDeliveryCustomer();
  const incrementOrderCount = useIncrementDeliveryCustomerOrderCount();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [saveCustomer, setSaveCustomer] = useState(true);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = useSearchDeliveryCustomers(customerSearch);

  // Initialize delivery fee from cafe settings default
  useEffect(() => {
    if (settings?.delivery_fee_default != null) {
      setDeliveryFee(settings.delivery_fee_default.toString());
    }
  }, [settings?.delivery_fee_default]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSavedCustomer = (customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
    notes: string | null;
  }) => {
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setDeliveryAddress(customer.address);
    setDeliveryNotes(customer.notes || '');
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDeliveryNotes('');
  };

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
    const taxRate =
      settings?.tax_enabled && settings.tax_percentage > 0 ? settings.tax_percentage / 100 : 0;
    const tax = subtotal * taxRate;
    const fee = Number.parseFloat(deliveryFee) || 0;
    return { subtotal, tax, deliveryFee: fee, total: subtotal + tax + fee };
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) return;

    if (selectedItems.length === 0) {
      alert(t('orders.addAtLeastOneItem'));
      return;
    }

    setIsSubmitting(true);

    try {
      const { subtotal, tax, total, deliveryFee: fee } = calculateTotal();

      const newOrder = await createOrder.mutateAsync({
        table_id: null,
        order_type: 'delivery',
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        delivery_notes: deliveryNotes.trim() || null,
        delivery_fee: fee,
        assigned_waiter_id: staffId,
        status: 'new',
        subtotal,
        tax,
        total,
      } as Partial<OrdersInsert> as OrdersInsert);

      const orderItems = selectedItems.map((item) => ({
        order_id: newOrder.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        item_price: item.menuItem.price,
        quantity: item.quantity,
        notes: item.notes || null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItems);

      // Save or update delivery customer
      if (selectedCustomerId) {
        incrementOrderCount.mutate(selectedCustomerId);
      } else if (saveCustomer) {
        createDeliveryCustomer.mutate({
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: deliveryAddress.trim(),
          notes: deliveryNotes.trim() || null,
        });
      }

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setDeliveryNotes('');
      setDeliveryFee(settings?.delivery_fee_default?.toString() || '0');
      setSelectedItems([]);
      setSearchQuery('');
      setCustomerSearch('');
      setSelectedCustomerId(null);
      setSaveCustomer(true);

      onSuccess?.(newOrder.id);
      onClose();
    } catch (error) {
      console.error('Error creating delivery order:', error);
      alert(t('orders.failedCreateOrder'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const { subtotal, tax, deliveryFee: fee, total } = calculateTotal();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                {t('delivery.createDeliveryOrder')}
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Customer Info, Delivery Details & Menu */}
            <div className="space-y-6">
              {/* Customer Information */}
              <div>
                <h3 className="font-semibold text-lg mb-4">{t('orders.customerInformation')}</h3>

                {/* Customer Search */}
                <div className="relative mb-4" ref={customerSearchRef}>
                  {selectedCustomerId ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <User className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">
                        {t('delivery.savedCustomer')}: {customerName}
                      </span>
                      <button
                        onClick={clearSelectedCustomer}
                        className="ml-auto text-purple-400 hover:text-purple-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value);
                            setShowCustomerDropdown(true);
                          }}
                          onFocus={() => {
                            if (customerSearch.length >= 2) setShowCustomerDropdown(true);
                          }}
                          placeholder={t('delivery.searchSavedCustomers')}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        />
                      </div>
                      {showCustomerDropdown && customerSearch.length >= 2 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {searchResults && searchResults.length > 0 ? (
                            searchResults.map((customer) => (
                              <button
                                key={customer.id}
                                onClick={() => selectSavedCustomer(customer)}
                                className="w-full px-4 py-3 text-left hover:bg-purple-50 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-sm">{customer.name}</div>
                                    <div className="text-xs text-gray-500">{customer.phone}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-gray-400 line-clamp-1 max-w-[150px]">
                                      {customer.address}
                                    </div>
                                    {customer.order_count > 0 && (
                                      <div className="text-xs text-purple-600">
                                        {t('delivery.customerOrders', {
                                          count: customer.order_count,
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500">
                              {t('delivery.noSavedCustomers')}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="inline h-4 w-4 mr-1" />
                      {t('delivery.customerName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={t('delivery.customerName')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="inline h-4 w-4 mr-1" />
                      {t('delivery.phoneNumber')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+994 50 123 4567"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <MapPin className="inline h-4 w-4 mr-1" />
                      {t('delivery.deliveryAddress')} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder={t('delivery.fullDeliveryAddress')}
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                      {deliveryAddress.trim() && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress.trim())}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute right-2 top-2 p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-md transition-colors"
                          title={t('delivery.openInMaps')}
                        >
                          <MapIcon className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <StickyNote className="inline h-4 w-4 mr-1" />
                        {t('delivery.deliveryNotes')}
                      </label>
                      <textarea
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                        placeholder={t('delivery.ringDoorbell')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Truck className="inline h-4 w-4 mr-1" />
                        {t('delivery.deliveryFee')}
                      </label>
                      <NumberInput
                        value={deliveryFee}
                        onChange={setDeliveryFee}
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                      />
                      {settings?.delivery_fee_default != null && (
                        <p className="text-xs text-gray-500 mt-1">
                          Default: {formatPrice(settings.delivery_fee_default)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Save customer checkbox (only for new customers) */}
                  {!selectedCustomerId && (
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveCustomer}
                        onChange={(e) => setSaveCustomer(e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      {t('delivery.saveCustomer')}
                    </label>
                  )}
                </div>
              </div>

              {/* Menu Items Selection */}
              <div>
                <h3 className="font-semibold text-lg mb-4">{t('orders.addItems')}</h3>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('orders.searchMenuItems')}
                  className="w-full px-4 py-2 mb-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <div className="max-h-64 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      disabled={!item.is_available}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${
                        item.is_available
                          ? 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                          : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        {!item.is_available && (
                          <div className="text-xs text-red-600">{t('orders.unavailable')}</div>
                        )}
                      </div>
                      <div className="font-semibold">{formatPrice(item.price * taxMultiplier)}</div>
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
                              {formatPrice(item.menuItem.price * taxMultiplier)}{' '}
                              {t('each', { ns: 'common' })}
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
                            {formatPrice(item.menuItem.price * item.quantity * taxMultiplier)}
                          </span>
                        </div>

                        {/* Notes */}
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => updateNotes(item.menuItem.id, e.target.value)}
                          placeholder={t('orders.specialRequestsShort')}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-purple-500"
                          maxLength={200}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Summary */}
              {selectedItems.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h3 className="font-semibold mb-3">{t('orders.orderSummary')}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('subtotal', { ns: 'common' })}:</span>
                      <span className="font-medium">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {t('orders.taxPercent', {
                          percent: String(settings?.tax_percentage ?? 18),
                        })}
                        :
                      </span>
                      <span className="font-medium">{formatPrice(tax)}</span>
                    </div>
                    {fee > 0 && (
                      <div className="flex justify-between text-purple-700">
                        <span>{t('deliveryFee', { ns: 'common' })}:</span>
                        <span className="font-medium">{formatPrice(fee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-purple-200">
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
                !deliveryAddress.trim() ||
                selectedItems.length === 0
              }
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSubmitting
                ? t('orders.creating')
                : `${t('delivery.createDeliveryOrder')} · ${formatPrice(total)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
