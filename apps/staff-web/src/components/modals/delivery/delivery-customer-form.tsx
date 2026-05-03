'use client';

import { useTranslation } from '@gustri/i18n';
import { NumberInput } from '@gustri/ui-web';
import { Map as MapIcon, MapPin, Phone, Search, StickyNote, Truck, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchDeliveryCustomers } from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';

// Search results never carry the plaintext phone — column-level grants on
// `delivery_customers` hide ciphertext from non-admin sessions, and the
// hash-based `find_delivery_customer_by_phone` RPC returns the row without
// it. The form treats `phone` as something the waiter types in this
// session, not something we autofill from the directory.
interface DeliveryCustomer {
  id: string;
  name: string;
  address: string;
  notes: string | null;
  order_count: number;
}

interface CustomerInfo {
  customerId: string | null;
  name: string;
  phone: string;
  address: string;
  notes: string;
  saveCustomer: boolean;
}

interface DeliveryCustomerFormProps {
  customer: CustomerInfo;
  onCustomerChange: (update: Partial<CustomerInfo>) => void;
  deliveryFee: string;
  onDeliveryFeeChange: (value: string) => void;
  defaultDeliveryFee: number | null | undefined;
}

export function DeliveryCustomerForm({
  customer,
  onCustomerChange,
  deliveryFee,
  onDeliveryFeeChange,
  defaultDeliveryFee,
}: DeliveryCustomerFormProps) {
  const { t } = useTranslation('staff');
  const formatPrice = useFormatPrice();

  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = useSearchDeliveryCustomers(customerSearch);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSavedCustomer = (c: DeliveryCustomer) => {
    onCustomerChange({
      customerId: c.id,
      name: c.name,
      address: c.address,
      notes: c.notes || '',
    });
    setCustomerSearch('');
    setShowCustomerDropdown(false);
  };

  const clearSelectedCustomer = () => {
    onCustomerChange({
      customerId: null,
      name: '',
      phone: '',
      address: '',
      notes: '',
    });
  };

  return (
    <div>
      <h3 className="font-semibold text-lg mb-4">{t('orders.customerInformation')}</h3>

      {/* Customer Search */}
      <div className="relative mb-4" ref={customerSearchRef}>
        {customer.customerId ? (
          <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg">
            <User className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">
              {t('delivery.savedCustomer')}: {customer.name}
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
                  searchResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => selectSavedCustomer(c)}
                      className="w-full px-4 py-3 text-left hover:bg-purple-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{c.name}</div>
                          <div className="text-xs text-gray-400 line-clamp-1 max-w-[220px]">
                            {c.address}
                          </div>
                        </div>
                        {c.order_count > 0 && (
                          <div className="text-xs text-purple-600">
                            {t('delivery.customerOrders', { count: c.order_count })}
                          </div>
                        )}
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
            value={customer.name}
            onChange={(e) => onCustomerChange({ name: e.target.value })}
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
            value={customer.phone}
            onChange={(e) => onCustomerChange({ phone: e.target.value })}
            placeholder={t('phonePlaceholder', { ns: 'common' })}
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
              value={customer.address}
              onChange={(e) => onCustomerChange({ address: e.target.value })}
              placeholder={t('delivery.fullDeliveryAddress')}
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={2}
            />
            {customer.address.trim() && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address.trim())}`}
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
              value={customer.notes}
              onChange={(e) => onCustomerChange({ notes: e.target.value })}
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
              onChange={onDeliveryFeeChange}
              min={0}
              step={0.01}
              placeholder="0.00"
            />
            {defaultDeliveryFee != null && (
              <p className="text-xs text-gray-500 mt-1">
                Default: {formatPrice(defaultDeliveryFee)}
              </p>
            )}
          </div>
        </div>

        {/* Save customer checkbox (only for new customers) */}
        {!customer.customerId && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={customer.saveCustomer}
              onChange={(e) => onCustomerChange({ saveCustomer: e.target.checked })}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            {t('delivery.saveCustomer')}
          </label>
        )}
      </div>
    </div>
  );
}
