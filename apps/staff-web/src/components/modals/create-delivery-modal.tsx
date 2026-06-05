'use client';

import { DEFAULT_TAX_PERCENTAGE } from '@gustri/core';
import type { Category, MenuItem, OrdersInsert } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import { randomUUIDv4, useStableClientRequestId } from '@gustri/queries';
import { Button } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { Truck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MenuItemPickerWithCategories } from '@/components/orders/menu-item-picker-with-categories';
import { BaseModal } from '@/components/ui/base-modal';
import {
  useAddOrderItems,
  useCafeSettings,
  useCreateDeliveryCustomer,
  useCreateOrder,
  useIncrementDeliveryCustomerOrderCount,
  useTaxMultiplier,
} from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useIsOnline } from '@/hooks/use-is-online';
import { DeliveryCustomerForm } from './delivery/delivery-customer-form';
import { type SelectedItem, SelectedItemsList } from './delivery/selected-items-list';

interface CreateDeliveryModalProps {
  staffId: string;
  menuItems: MenuItem[];
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}

export function CreateDeliveryModal({
  staffId,
  menuItems,
  categories,
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
  const isOnline = useIsOnline();
  const orderIdempotencyKey = useStableClientRequestId();
  // Per-line idempotency keys keyed by menu_item.id. The order-create
  // step is one logical click so a single key suffices, but item insert
  // is a batch with a per-row partial unique index — sharing a key
  // across rows would self-conflict. Stamping a stable key per line
  // means a retry-after-items-failure deduplicates each row individually
  // via `dedupeInsertMany`.
  const itemIdempotencyKeysRef = useRef<Map<string, string>>(new Map());
  const getItemIdempotencyKey = useCallback((menuItemId: string) => {
    let key = itemIdempotencyKeysRef.current.get(menuItemId);
    if (!key) {
      key = randomUUIDv4();
      itemIdempotencyKeysRef.current.set(menuItemId, key);
    }
    return key;
  }, []);

  const [customer, setCustomer] = useState({
    customerId: null as string | null,
    name: '',
    phone: '',
    address: '',
    notes: '',
    saveCustomer: true,
  });
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const isSubmitting = createOrder.isPending || addOrderItems.isPending;

  useEffect(() => {
    if (settings?.delivery_fee_default != null) {
      setDeliveryFee(settings.delivery_fee_default.toString());
    }
  }, [settings?.delivery_fee_default]);

  const handleCustomerChange = useCallback(
    (update: Partial<typeof customer>) => setCustomer((prev) => ({ ...prev, ...update })),
    [],
  );

  const addItem = useCallback((menuItem: MenuItem) => {
    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map((item) =>
          item.menuItem.id === menuItem.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { menuItem, quantity: 1, notes: '' }];
    });
  }, []);

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedItems((prev) => prev.filter((item) => item.menuItem.id !== menuItemId));
    } else {
      setSelectedItems((prev) =>
        prev.map((item) => (item.menuItem.id === menuItemId ? { ...item, quantity } : item)),
      );
    }
  }, []);

  const updateNotes = useCallback((menuItemId: string, notes: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.menuItem.id === menuItemId ? { ...item, notes } : item)),
    );
  }, []);

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
    if (!customer.name.trim()) return;
    if (selectedItems.length === 0) {
      toast.error(t('orders.addAtLeastOneItem'));
      return;
    }

    try {
      // Totals are display-only — server derives them from order_items via
      // the recompute trigger. We still send `delivery_fee` because the
      // recompute reads it back off the order row to compute total.
      const { deliveryFee: fee } = calculateTotal();

      const trimmedPhone = customer.phone.trim();
      const trimmedAddress = customer.address.trim();

      const newOrder = await createOrder.mutateAsync({
        table_id: null,
        order_type: 'delivery',
        customer_name: customer.name.trim(),
        customer_phone: trimmedPhone || null,
        delivery_address: trimmedAddress || null,
        delivery_notes: customer.notes.trim() || null,
        delivery_fee: fee,
        assigned_waiter_id: staffId,
        status: 'new',
        client_request_id: orderIdempotencyKey.get(),
      } as Partial<OrdersInsert> as OrdersInsert);

      const orderItems = selectedItems.map((item) => ({
        order_id: newOrder.id,
        menu_item_id: item.menuItem.id,
        item_name: item.menuItem.name,
        item_price: item.menuItem.price,
        quantity: item.quantity,
        notes: item.notes || null,
        status: 'pending' as const,
        client_request_id: getItemIdempotencyKey(item.menuItem.id),
      }));

      await addOrderItems.mutateAsync(orderItems);

      if (customer.customerId) {
        incrementOrderCount.mutate(customer.customerId);
      } else if (customer.saveCustomer && (trimmedPhone || trimmedAddress)) {
        // Skip the profile save for name-only entries — the saved-customer
        // search is keyed off phone_hash (the primary path) with address
        // as the visible discriminator in the dropdown. A name-only row
        // is unfindable by phone and indistinguishable from other
        // name-only stubs, so it just clutters the directory.
        createDeliveryCustomer.mutate({
          name: customer.name.trim(),
          phone: trimmedPhone || null,
          address: trimmedAddress || null,
          notes: customer.notes.trim() || null,
        });
      }

      orderIdempotencyKey.reset();
      itemIdempotencyKeysRef.current.clear();

      // Reset form
      setCustomer({
        customerId: null,
        name: '',
        phone: '',
        address: '',
        notes: '',
        saveCustomer: true,
      });
      setDeliveryFee(settings?.delivery_fee_default?.toString() || '0');
      setSelectedItems([]);

      onSuccess?.(newOrder.id);
      onClose();
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t('orders.failedCreateOrder'));
    }
  };

  const { subtotal, tax, deliveryFee: fee, total } = calculateTotal();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('delivery.createDeliveryOrder')}
      icon={<Truck className="h-5 w-5 text-purple-600" />}
      size="5xl"
      footer={
        <>
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={isSubmitting}>
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || !isOnline || !customer.name.trim() || selectedItems.length === 0
            }
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSubmitting
              ? t('orders.creating')
              : `${t('delivery.createDeliveryOrder')} · ${formatPrice(total)}`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <DeliveryCustomerForm
            customer={customer}
            onCustomerChange={handleCustomerChange}
            deliveryFee={deliveryFee}
            onDeliveryFeeChange={setDeliveryFee}
            defaultDeliveryFee={settings?.delivery_fee_default}
          />
          <MenuItemPickerWithCategories
            menuItems={menuItems}
            categories={categories}
            taxMultiplier={taxMultiplier}
            accent="purple"
            onAddItem={addItem}
          />
        </div>

        <div className="space-y-6">
          <SelectedItemsList
            items={selectedItems}
            taxMultiplier={taxMultiplier}
            onUpdateQuantity={updateQuantity}
            onUpdateNotes={updateNotes}
          />

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
                      percent: String(settings?.tax_percentage ?? DEFAULT_TAX_PERCENTAGE),
                    })}
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
    </BaseModal>
  );
}
