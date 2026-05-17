import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { MenuItem, OrdersInsert } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Dialog, Divider, IconButton, Portal, Switch } from 'react-native-paper';
import { useCategories, useCreateOrder, useCurrencySymbol } from '@/hooks/local';
import {
  useAddOrderItems,
  useCafeSettings,
  useCreateDeliveryCustomer,
  useMenuItems,
} from '@/hooks/shared';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text, TextInput } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { COLORS } from '@/theme';

interface CreateDeliveryModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

type CartItem = {
  menuItem: MenuItem;
  quantity: number;
};

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
  const { data: menuItems, isLoading: menuLoading } = useMenuItems({ isAvailable: true });
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
  // Map keyed by menu_item.id so add/remove operations are O(1) and the
  // selected-items list survives category-switch re-renders.
  const [cart, setCart] = useState<Map<string, CartItem>>(() => new Map());
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

  const cartItems = useMemo(() => Array.from(cart.values()), [cart]);
  const hasItems = cartItems.length > 0;

  const filteredMenuItems = useMemo(() => {
    if (!menuItems) return [];
    if (!selectedCategoryId) return menuItems;
    return menuItems.filter((item) => item.category_id === selectedCategoryId);
  }, [menuItems, selectedCategoryId]);

  // Totals derived locally for the CTA preview. Server recomputes the
  // authoritative totals via the order_items trigger — these are display-only.
  const totals = useMemo(() => {
    const subtotal = cartItems.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0);
    const taxRate =
      settings?.tax_enabled && settings.tax_percentage > 0 ? settings.tax_percentage / 100 : 0;
    const tax = subtotal * taxRate;
    const fee = Number.parseFloat(deliveryFee) || 0;
    return { subtotal, tax, deliveryFee: fee, total: subtotal + tax + fee };
  }, [cartItems, settings, deliveryFee]);

  const isValid = !!customerName.trim() && isPhoneValid && hasItems;
  const isSubmitting = createOrder.isPending || addOrderItems.isPending;

  const addItem = useCallback((menuItem: MenuItem) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(menuItem.id);
      next.set(menuItem.id, {
        menuItem,
        quantity: existing ? existing.quantity + 1 : 1,
      });
      return next;
    });
  }, []);

  const updateQty = useCallback((menuItemId: string, delta: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(menuItemId);
      if (!existing) return prev;
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        next.delete(menuItemId);
      } else {
        next.set(menuItemId, { ...existing, quantity: newQty });
      }
      return next;
    });
  }, []);

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDeliveryNotes('');
    setDeliveryFee(settings?.delivery_fee_default?.toString() || '0');
    setSaveCustomer(true);
    setCart(new Map());
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
        menu_item_id: c.menuItem.id,
        item_name: c.menuItem.name,
        item_price: c.menuItem.price,
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

  const openInMaps = () => {
    if (deliveryAddress.trim()) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress.trim())}`;
      Linking.openURL(url);
    }
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
                <TextInput
                  label={t('delivery.customerName')}
                  value={customerName}
                  onChangeText={setCustomerName}
                  mode="outlined"
                  left={<TextInput.Icon icon="account" />}
                />
                <TextInput
                  label={t('delivery.phoneNumber')}
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  mode="outlined"
                  keyboardType="phone-pad"
                  left={<TextInput.Icon icon="phone" />}
                  error={!!customerPhone.trim() && !isPhoneValid}
                />
                <View>
                  <TextInput
                    label={t('delivery.deliveryAddress')}
                    value={deliveryAddress}
                    onChangeText={setDeliveryAddress}
                    mode="outlined"
                    multiline
                    numberOfLines={2}
                    left={<TextInput.Icon icon="map-marker" />}
                  />
                  {deliveryAddress.trim() && (
                    <TouchableOpacity onPress={openInMaps} style={styles.mapsLink}>
                      <MaterialCommunityIcons name="google-maps" size={14} color={COLORS.purple} />
                      <Text variant="bodySmall" style={styles.mapsText}>
                        {t('delivery.viewOnMaps')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  label={t('delivery.deliveryNotes')}
                  value={deliveryNotes}
                  onChangeText={setDeliveryNotes}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  left={<TextInput.Icon icon="note-text" />}
                />
                <TextInput
                  label={tCommon('deliveryFee')}
                  value={deliveryFee}
                  onChangeText={setDeliveryFee}
                  mode="outlined"
                  keyboardType="numeric"
                  left={<TextInput.Icon icon="truck-delivery" />}
                />
                {settings?.delivery_fee_default != null ? (
                  <Text variant="bodySmall" style={styles.defaultFee}>
                    {t('delivery.defaultLabel')} {settings.currency_symbol || '$'}
                    {settings.delivery_fee_default.toFixed(2)}
                  </Text>
                ) : null}

                {/* Save customer toggle */}
                <View style={styles.toggleRow}>
                  <Text variant="bodyMedium" style={styles.toggleLabel}>
                    {t('delivery.saveCustomer')}
                  </Text>
                  <Switch value={saveCustomer} onValueChange={setSaveCustomer} />
                </View>

                <Divider />

                {/* Menu picker */}
                <Text variant="titleSmall" style={styles.sectionHeader}>
                  {t('orders.addItems')}
                </Text>
                {menuLoading ? (
                  <Text variant="bodySmall" style={styles.muted}>
                    {t('orders.loadingMenu')}
                  </Text>
                ) : (
                  <>
                    {/* Categories chip bar */}
                    {categories && categories.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryRow}
                      >
                        {categories.map((cat) => {
                          const active = cat.id === selectedCategoryId;
                          return (
                            <TouchableOpacity
                              key={cat.id}
                              onPress={() => setSelectedCategoryId(cat.id)}
                              style={[styles.categoryChip, active && styles.categoryChipActive]}
                            >
                              <Text
                                variant="labelMedium"
                                style={[
                                  styles.categoryChipText,
                                  active && styles.categoryChipTextActive,
                                ]}
                              >
                                {cat.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    {/* Items in selected category. Empty state intentionally
                      omitted — a category with zero available items is rare
                      and self-explanatory (the chip is selected but no rows
                      render). Adding a key here would block PR on 20-locale
                      translation for a near-unreachable string. */}
                    {filteredMenuItems.length > 0 && (
                      <View style={styles.menuItemsList}>
                        {filteredMenuItems.map((item) => {
                          const inCart = cart.get(item.id)?.quantity ?? 0;
                          return (
                            <TouchableOpacity
                              key={item.id}
                              onPress={() => addItem(item)}
                              style={styles.menuItemRow}
                            >
                              <View style={styles.menuItemInfo}>
                                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                                  {item.name}
                                </Text>
                                <Text variant="bodySmall" style={styles.muted}>
                                  {currencySymbol}
                                  {item.price.toFixed(2)}
                                </Text>
                              </View>
                              <View style={styles.menuItemAdd}>
                                {inCart > 0 && (
                                  <Text
                                    variant="labelMedium"
                                    style={styles.inCartBadge}
                                  >{`${inCart}x`}</Text>
                                )}
                                <MaterialCommunityIcons
                                  name="plus-circle"
                                  size={22}
                                  color={COLORS.purple}
                                />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}

                {hasItems && (
                  <>
                    <Divider />
                    {/* Selected items */}
                    <Text variant="titleSmall" style={styles.sectionHeader}>
                      {t('orders.orderSummary')}
                    </Text>
                    {cartItems.map((c) => (
                      <View key={c.menuItem.id} style={styles.selectedRow}>
                        <View style={styles.selectedInfo}>
                          <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                            {c.menuItem.name}
                          </Text>
                          <Text variant="bodySmall" style={styles.muted}>
                            {currencySymbol}
                            {c.menuItem.price.toFixed(2)} {t('payment.each')}
                          </Text>
                        </View>
                        <View style={styles.qtyControls}>
                          <IconButton
                            icon="minus"
                            mode="outlined"
                            size={16}
                            onPress={() => updateQty(c.menuItem.id, -1)}
                          />
                          <Text variant="titleSmall" style={styles.qtyText}>
                            {c.quantity}
                          </Text>
                          <IconButton
                            icon="plus"
                            mode="outlined"
                            size={16}
                            onPress={() => updateQty(c.menuItem.id, 1)}
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
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  mapsText: { color: COLORS.purple, fontSize: 11 },
  defaultFee: { color: COLORS.textLight, marginTop: -8 },
  bold: { fontWeight: '700', color: COLORS.textPrimary },
  muted: { color: COLORS.textMuted },
  sectionHeader: { fontWeight: '700', color: COLORS.textPrimary, marginTop: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: { flex: 1, color: COLORS.textPrimary },
  categoryRow: { gap: 6, paddingVertical: 4 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: COLORS.borderLight,
  },
  categoryChipActive: { backgroundColor: COLORS.purple },
  categoryChipText: { color: COLORS.textSecondary, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },
  menuItemsList: { gap: 6 },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: COLORS.borderLight,
  },
  menuItemInfo: { flex: 1, marginRight: 8 },
  menuItemAdd: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inCartBadge: {
    color: COLORS.purple,
    fontWeight: '700',
  },
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
