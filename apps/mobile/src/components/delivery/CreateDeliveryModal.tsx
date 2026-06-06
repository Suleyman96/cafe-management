import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrdersInsert } from '@gustri/database/types';
import { useTranslation } from '@gustri/i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, IconButton, Portal } from 'react-native-paper';
import { DeliveryCustomerForm } from '@/components/delivery/DeliveryCustomerForm';
import { MenuItemPicker } from '@/components/delivery/MenuItemPicker';
import { useCategories, useCreateOrder, useCurrencySymbol } from '@/hooks/local';
import {
  useAddOrderItems,
  useCafeSettings,
  useCreateDeliveryCustomer,
  useMenuItems,
} from '@/hooks/shared';
import { useOrderCart } from '@/hooks/use-order-cart';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { COLORS } from '@/theme';

interface CreateDeliveryModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

export const CreateDeliveryModal = React.memo(function CreateDeliveryModal({
  visible,
  onDismiss,
  onSuccess,
}: CreateDeliveryModalProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const staffId = useAuthStore((s) => s.staff?.id ?? null);
  const createOrder = useCreateOrder();
  const addOrderItems = useAddOrderItems();
  const { data: settings } = useCafeSettings();
  // Hide items the admin has flagged as not deliverable (e.g. ice cream,
  // delicate plated desserts that don't survive transit). Mirrors the web
  // create-delivery modal — both surfaces must agree on what the customer
  // could see for delivery, otherwise a waiter taking a phone order would
  // offer items the web flow doesn't.
  const { data: menuItems, isLoading: menuLoading } = useMenuItems({
    isAvailable: true,
    isDeliverable: true,
  });
  const { data: categories } = useCategories();
  const createDeliveryCustomer = useCreateDeliveryCustomer();
  const currencySymbol = useCurrencySymbol();
  const { showSuccess, showError } = useSnackbar();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(settings?.delivery_fee_default?.toString() || '0');
  const [saveCustomer, setSaveCustomer] = useState(true);
  const cart = useOrderCart();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    setDeliveryFee(settings?.delivery_fee_default?.toString() || '0');
  }, [settings?.delivery_fee_default]);

  useEffect(() => {
    if (categories?.length && selectedCategoryId === null) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const phoneRegex = /^\+?[\d\s\-()]{7,}$/;
  const trimmedPhone = customerPhone.trim();
  const isPhoneValid = !trimmedPhone || phoneRegex.test(trimmedPhone);

  const { cartItems, hasItems, subtotal } = cart;

  const filteredMenuItems = useMemo(() => {
    if (!menuItems) return [];
    if (!selectedCategoryId) return menuItems;
    return menuItems.filter((item) => item.category_id === selectedCategoryId);
  }, [menuItems, selectedCategoryId]);

  // Totals derived locally for the CTA preview. Server recomputes the
  // authoritative totals via the order_items trigger — these are display-only.
  const totals = useMemo(() => {
    const taxRate =
      settings?.tax_enabled && settings.tax_percentage > 0 ? settings.tax_percentage / 100 : 0;
    const tax = subtotal * taxRate;
    const fee = Number.parseFloat(deliveryFee) || 0;
    return { subtotal, tax, deliveryFee: fee, total: subtotal + tax + fee };
  }, [subtotal, settings, deliveryFee]);

  const isValid = !!customerName.trim() && isPhoneValid && hasItems;
  const isSubmitting = createOrder.isPending || addOrderItems.isPending;

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDeliveryNotes('');
    setDeliveryFee(settings?.delivery_fee_default?.toString() || '0');
    setSaveCustomer(true);
    cart.clear();
  };

  const handleCreate = async () => {
    // CTA is disabled when these aren't satisfied — runtime guards are
    // defense-in-depth only; the error path mirrors web's `orders.addAtLeastOneItem`
    // toast so a missed disable can't silently submit an empty order.
    if (!customerName.trim() || !hasItems) {
      showError(t('orders.addAtLeastOneItem'));
      return;
    }

    const trimmedAddress = deliveryAddress.trim();

    try {
      // Server derives totals from order_items via the recompute trigger;
      // delivery_fee is the only money field set up-front since recompute
      // reads it back off the order row to fold into the total.
      const newOrder = await createOrder.mutateAsync({
        order_type: 'delivery',
        status: 'new',
        customer_name: customerName.trim(),
        customer_phone: trimmedPhone || null,
        delivery_address: trimmedAddress || null,
        delivery_notes: deliveryNotes.trim() || null,
        delivery_fee: Number.parseFloat(deliveryFee) || 0,
        assigned_waiter_id: staffId,
      } as Partial<OrdersInsert> as OrdersInsert);

      const orderItemPayload = cartItems.map((c) => ({
        order_id: newOrder.id,
        menu_item_id: c.id,
        item_name: c.name,
        item_price: c.price,
        quantity: c.quantity,
        notes: null,
        status: 'pending' as const,
      }));

      await addOrderItems.mutateAsync(orderItemPayload);

      // Optional saved-customer profile. Skip name-only entries because the
      // saved-customer search keys off phone_hash; a name-only stub is
      // unfindable and just clutters the directory. Mirrors the web modal's
      // gate.
      if (saveCustomer && (trimmedPhone || trimmedAddress)) {
        createDeliveryCustomer.mutate({
          name: customerName.trim(),
          phone: trimmedPhone || null,
          address: trimmedAddress || null,
          notes: deliveryNotes.trim() || null,
        });
      }

      showSuccess(t('delivery.orderCreated'));
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('delivery.failedCreateOrder'));
    }
  };

  const handleDismiss = () => {
    resetForm();
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={handleDismiss} style={styles.dialog}>
        <Dialog.Title style={styles.title}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="truck-delivery" size={20} color={COLORS.purple} />
            <Text variant="titleMedium" style={styles.titleText}>
              {t('delivery.newDeliveryOrder')}
            </Text>
          </View>
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoid}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.form}>
                {/* Customer details */}
                <DeliveryCustomerForm
                  customerName={customerName}
                  onCustomerNameChange={setCustomerName}
                  customerPhone={customerPhone}
                  onCustomerPhoneChange={setCustomerPhone}
                  isPhoneValid={isPhoneValid}
                  deliveryAddress={deliveryAddress}
                  onDeliveryAddressChange={setDeliveryAddress}
                  deliveryNotes={deliveryNotes}
                  onDeliveryNotesChange={setDeliveryNotes}
                  deliveryFee={deliveryFee}
                  onDeliveryFeeChange={setDeliveryFee}
                  defaultDeliveryFee={settings?.delivery_fee_default}
                  defaultCurrencySymbol={settings?.currency_symbol || '$'}
                  saveCustomer={saveCustomer}
                  onSaveCustomerChange={setSaveCustomer}
                />

                <Divider />

                {/* Menu picker */}
                <Text variant="titleSmall" style={styles.sectionHeader}>
                  {t('orders.addItems')}
                </Text>
                <MenuItemPicker
                  loading={menuLoading}
                  categories={categories}
                  filteredMenuItems={filteredMenuItems}
                  selectedCategoryId={selectedCategoryId}
                  onSelectCategory={setSelectedCategoryId}
                  getQuantity={cart.getQuantity}
                  onAddItem={cart.addItem}
                  currencySymbol={currencySymbol}
                />

                {hasItems && (
                  <>
                    <Divider />
                    {/* Selected items */}
                    <Text variant="titleSmall" style={styles.sectionHeader}>
                      {t('orders.orderSummary')}
                    </Text>
                    {cartItems.map((c) => (
                      <View key={c.id} style={styles.selectedRow}>
                        <View style={styles.selectedInfo}>
                          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                            {c.name}
                          </Text>
                          <Text variant="bodySmall" style={styles.muted}>
                            {currencySymbol}
                            {c.price.toFixed(2)} {t('payment.each')}
                          </Text>
                        </View>
                        <View style={styles.qtyControls}>
                          <IconButton
                            icon="minus"
                            mode="outlined"
                            size={16}
                            onPress={() => cart.updateQty(c.id, -1)}
                          />
                          <Text variant="titleSmall" style={styles.qtyText}>
                            {c.quantity}
                          </Text>
                          <IconButton
                            icon="plus"
                            mode="outlined"
                            size={16}
                            onPress={() => cart.updateQty(c.id, 1)}
                          />
                        </View>
                      </View>
                    ))}

                    {/* Order totals */}
                    <View style={styles.totalsCard}>
                      <View style={styles.totalsRow}>
                        <Text variant="bodyMedium" style={styles.muted}>
                          {tCommon('subtotal')}
                        </Text>
                        <Text variant="bodyMedium">
                          {currencySymbol}
                          {totals.subtotal.toFixed(2)}
                        </Text>
                      </View>
                      {totals.tax > 0 && (
                        <View style={styles.totalsRow}>
                          <Text variant="bodyMedium" style={styles.muted}>
                            {t('orders.taxPercent', {
                              percent: String(settings?.tax_percentage ?? 0),
                            })}
                          </Text>
                          <Text variant="bodyMedium">
                            {currencySymbol}
                            {totals.tax.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {totals.deliveryFee > 0 && (
                        <View style={styles.totalsRow}>
                          <Text
                            variant="bodyMedium"
                            style={[styles.muted, { color: COLORS.purple }]}
                          >
                            {tCommon('deliveryFee')}
                          </Text>
                          <Text variant="bodyMedium" style={{ color: COLORS.purple }}>
                            {currencySymbol}
                            {totals.deliveryFee.toFixed(2)}
                          </Text>
                        </View>
                      )}
                      <Divider style={{ marginVertical: 6 }} />
                      <View style={styles.totalsRow}>
                        <Text variant="titleMedium" style={styles.bold}>
                          {tCommon('total')}
                        </Text>
                        <Text variant="titleMedium" style={[styles.bold, { color: COLORS.purple }]}>
                          {currencySymbol}
                          {totals.total.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={handleDismiss} disabled={isSubmitting}>
            {tCommon('cancel')}
          </Button>
          <Button
            mode="contained"
            onPress={handleCreate}
            disabled={!isValid || isSubmitting}
            loading={isSubmitting}
            style={styles.createBtn}
          >
            {hasItems
              ? `${t('delivery.createDeliveryOrder')} · ${currencySymbol}${totals.total.toFixed(2)}`
              : t('delivery.createDeliveryOrder')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});

const styles = StyleSheet.create({
  dialog: { maxHeight: '90%' },
  title: { paddingBottom: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontWeight: '700', color: COLORS.textPrimary },
  scrollArea: { paddingHorizontal: 0 },
  keyboardAvoid: { flexShrink: 1 },
  form: { gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
  bold: { fontWeight: '700', color: COLORS.textPrimary },
  muted: { color: COLORS.textMuted },
  sectionHeader: { fontWeight: '700', color: COLORS.textPrimary, marginTop: 4 },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  selectedInfo: { flex: 1, marginRight: 8 },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyText: { minWidth: 20, textAlign: 'center', fontWeight: '700' },
  totalsCard: {
    backgroundColor: '#f5f3ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9d5ff',
    gap: 2,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createBtn: { backgroundColor: COLORS.purple },
});
