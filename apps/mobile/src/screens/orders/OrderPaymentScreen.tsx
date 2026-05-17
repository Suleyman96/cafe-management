import { ConflictError, NetworkError } from '@gustri/core';
import { useLocale, useTranslation } from '@gustri/i18n';
import { ErrorScreen, LoadingScreen } from '@gustri/ui-mobile';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Divider,
  IconButton,
  RadioButton,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import { OfflineGuardButton } from '@/components/OfflineGuardButton';
import { useCreatePayment, useCurrencySymbol, useOrder, useUpdateOrderStatus } from '@/hooks/local';
import { useCafeSettings, useOrderPayments, useOrderRemainingBalance } from '@/hooks/shared';
import { useSnackbar } from '@/hooks/use-snackbar';
import { TextInput } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { COLORS } from '@/theme';
import type { Order, OrderItemWithMenuItem, OrdersStackParamList } from '@/types';

type Route = RouteProp<OrdersStackParamList, 'OrderPayment'>;
type PaymentMode = 'full' | 'partial' | 'items';

// `useOrder` returns the bare row type for ergonomics, but `db.orders.findById`
// actually returns the order with its `order_items` (incl. `menu_item`) joined.
// We assert the runtime shape here so the items-mode picker compiles.
type OrderWithItems = Order & { order_items?: OrderItemWithMenuItem[] };

export default function OrderPaymentScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { orderId } = route.params;
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();

  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const locale = useLocale();

  const { data: order, isLoading, error, refetch } = useOrder(orderId);
  const { data: payments, refetch: refetchPayments } = useOrderPayments(orderId);
  // RPC-backed balance keeps mobile in sync with web's tax/proportional
  // accounting — never recompute remaining locally for items-mode payments,
  // since selected-item subtotals carry a proportional share of the order
  // tax that only the server's `get_remaining_balance` knows about.
  const { data: remainingBalance, refetch: refetchBalance } = useOrderRemainingBalance(orderId);
  const { data: cafeSettings } = useCafeSettings();
  const createPayment = useCreatePayment();
  const updateOrderStatus = useUpdateOrderStatus();
  const currencySymbol = useCurrencySymbol();

  const [mode, setMode] = useState<PaymentMode>('full');
  const [method, setMethod] = useState<'cash' | 'card' | 'digital'>('cash');
  const [partialAmount, setPartialAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  // Per-item selected qty (0 = unselected). Maps to web's
  // `selectedItemQuantities` for parity in `payment_type === 'specific_items'`.
  const [selectedItemQuantities, setSelectedItemQuantities] = useState<Map<string, number>>(
    () => new Map(),
  );

  const details = order as OrderWithItems | undefined;
  const orderTotal = order?.total ?? 0;
  const orderSubtotal = order?.subtotal ?? 0;
  const orderTax = order?.tax ?? 0;
  const balance = remainingBalance ?? orderTotal;

  // Cancelled items don't bill; already-paid items (covered by a prior
  // `specific_items` payment) can't be re-paid via the items mode.
  const payableItems = useMemo<OrderItemWithMenuItem[]>(
    () => (details?.order_items ?? []).filter((i) => i.status !== 'cancelled'),
    [details?.order_items],
  );

  const paidItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of payments ?? []) {
      if (p.payment_type === 'specific_items' && p.order_item_ids) {
        for (const id of p.order_item_ids) ids.add(id);
      }
    }
    return ids;
  }, [payments]);

  const unpaidItems = useMemo(
    () => payableItems.filter((i) => !paidItemIds.has(i.id)),
    [payableItems, paidItemIds],
  );

  // Selected items subtotal (pre-tax).
  const selectedSubtotal = useMemo(() => {
    let total = 0;
    for (const [itemId, qty] of selectedItemQuantities) {
      if (qty <= 0) continue;
      const item = unpaidItems.find((i) => i.id === itemId);
      if (item) total += qty * item.item_price;
    }
    return total;
  }, [selectedItemQuantities, unpaidItems]);

  // Proportional tax share for the selected slice. Mirrors web's calc.
  const selectedTax = useMemo(() => {
    if (orderTax <= 0 || orderSubtotal <= 0) return 0;
    return Math.round((selectedSubtotal / orderSubtotal) * orderTax * 100) / 100;
  }, [selectedSubtotal, orderSubtotal, orderTax]);

  const selectedItemsTotal = selectedSubtotal + selectedTax;

  const hasSelectedItems = useMemo(
    () => Array.from(selectedItemQuantities.values()).some((q) => q > 0),
    [selectedItemQuantities],
  );

  // All selected items at full quantity → eligible for `specific_items`
  // payment_type (DB trigger validates amount == items subtotal without tax).
  const allSelectedAtFullQty = useMemo(() => {
    for (const [itemId, qty] of selectedItemQuantities) {
      if (qty <= 0) continue;
      const item = unpaidItems.find((i) => i.id === itemId);
      if (item && qty < item.quantity) return false;
    }
    return true;
  }, [selectedItemQuantities, unpaidItems]);

  const updateItemQty = (itemId: string, maxQty: number, delta: number) => {
    setSelectedItemQuantities((prev) => {
      const next = new Map(prev);
      const cur = next.get(itemId) || 0;
      const target = Math.max(0, Math.min(maxQty, cur + delta));
      if (target === 0) next.delete(itemId);
      else next.set(itemId, target);
      return next;
    });
  };

  const computeAmount = (): number => {
    switch (mode) {
      case 'full':
        return balance;
      case 'partial':
        return parseFloat(partialAmount) || 0;
      case 'items':
        return selectedItemsTotal;
    }
  };

  const handleSubmit = async () => {
    let amount = computeAmount();
    if (amount <= 0) {
      showError(t('payment.validAmount'));
      return;
    }
    if (amount > balance + 0.01) {
      showError(t('payment.exceedsRemaining'));
      return;
    }
    if (amount > balance) amount = balance; // rounding cap

    if (!staff?.id) {
      showError(t('payment.notAuthenticated'));
      return;
    }

    // Decide payment_type + order_item_ids the same way web does — items
    // mode collapses to partial_amount when tax is non-zero (DB trigger
    // constraint) or items are at partial quantity.
    let paymentType: 'full' | 'partial_amount' | 'specific_items' = 'full';
    let orderItemIds: string[] | null = null;
    if (mode === 'partial') {
      paymentType = 'partial_amount';
    } else if (mode === 'items') {
      const hasTax = orderTax > 0;
      if (!hasTax && allSelectedAtFullQty && amount <= balance) {
        paymentType = 'specific_items';
        orderItemIds = Array.from(selectedItemQuantities.entries())
          .filter(([, qty]) => qty > 0)
          .map(([id]) => id);
      } else {
        paymentType = 'partial_amount';
      }
    }

    const tip = parseFloat(tipAmount) || 0;

    try {
      await createPayment.mutateAsync({
        order_id: orderId,
        received_by: staff.id,
        payment_type: paymentType,
        amount,
        tip_amount: tip,
        payment_method: method,
        order_item_ids: orderItemIds,
        notes: null,
      });

      const newRemaining = balance - amount;
      if (newRemaining <= 0) {
        await updateOrderStatus.mutateAsync({ orderId, status: 'closed' });
        showSuccess(t('orders.paymentProcessed'));
      } else {
        showSuccess(
          t('payment.paymentRecorded', { amount: `${currencySymbol}${amount.toFixed(2)}` }),
        );
      }
      navigation.goBack();
    } catch (err: unknown) {
      if (err instanceof ConflictError) {
        refetch();
        refetchPayments();
        refetchBalance();
        showError(err);
        return;
      }
      if (err instanceof NetworkError) {
        showError(t('payment.networkError'));
        return;
      }
      showError(err instanceof Error ? err : t('payment.paymentFailed'));
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !order)
    return <ErrorScreen error={error || t('orders.orderNotFound')} onRetry={refetch} />;

  const isFullyPaid = remainingBalance !== undefined && remainingBalance <= 0;
  const tipsEnabled = !!cafeSettings?.tips_enabled;
  const modeOptions = [
    { value: 'full', label: t('payment.fullPayment') },
    { value: 'partial', label: t('payment.partialAmount') },
    { value: 'items', label: t('payment.specificItems') },
  ];
  // Submit enable rule: each mode requires its own input. `items` mode also
  // requires at least one selection.
  const submitDisabled =
    createPayment.isPending ||
    (mode === 'partial' && !partialAmount) ||
    (mode === 'items' && !hasSelectedItems);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Order Summary */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.bold}>
              {t('orders.orderHash', { number: order.order_number || '—' })}
            </Text>
            <Divider style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text variant="bodyMedium">{tCommon('total')}</Text>
              <Text variant="titleMedium" style={styles.bold}>
                {currencySymbol}
                {orderTotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text variant="bodyMedium">{t('payment.alreadyPaid')}</Text>
              <Text variant="bodyMedium" style={{ color: COLORS.success, fontWeight: '600' }}>
                {currencySymbol}
                {(orderTotal - balance).toFixed(2)}
              </Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text variant="titleMedium" style={styles.bold}>
                {t('orders.remaining')}
              </Text>
              <Text
                variant="titleLarge"
                style={{ color: balance > 0 ? COLORS.danger : COLORS.success, fontWeight: '700' }}
              >
                {currencySymbol}
                {balance.toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {!isFullyPaid && (
          <>
            {/* Payment Mode */}
            <Card style={styles.card}>
              <Card.Content style={styles.modeCardContent}>
                <Text variant="titleMedium" style={styles.bold}>
                  {t('payment.paymentType')}
                </Text>
                <SegmentedButtons
                  value={mode}
                  onValueChange={(v) => setMode(v as PaymentMode)}
                  buttons={modeOptions}
                  density="medium"
                />
              </Card.Content>
            </Card>

            {/* Mode-specific UI */}
            {mode === 'partial' && (
              <Card style={styles.card}>
                <Card.Content style={styles.amountSection}>
                  <TextInput
                    label={tCommon('amount')}
                    value={partialAmount}
                    onChangeText={setPartialAmount}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    left={<TextInput.Affix text={currencySymbol} />}
                  />
                  <Button
                    mode="outlined"
                    onPress={() => setPartialAmount(balance.toFixed(2))}
                    compact
                  >
                    {t('payment.payFull', { amount: `${currencySymbol}${balance.toFixed(2)}` })}
                  </Button>
                </Card.Content>
              </Card>
            )}

            {mode === 'items' && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.bold}>
                    {t('payment.selectItemsToPay')}
                  </Text>
                  <Divider style={styles.divider} />
                  {unpaidItems.length === 0 ? (
                    <Text variant="bodyMedium" style={styles.muted}>
                      {t('payment.noItemsToPay')}
                    </Text>
                  ) : (
                    unpaidItems.map((item) => {
                      const qty = selectedItemQuantities.get(item.id) || 0;
                      return (
                        <View key={item.id} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                              {item.menu_item?.name ?? '—'}
                            </Text>
                            <Text variant="bodySmall" style={styles.muted}>
                              {currencySymbol}
                              {item.item_price.toFixed(2)} {t('payment.each')} · {item.quantity}
                            </Text>
                          </View>
                          <View style={styles.qtyControls}>
                            <IconButton
                              icon="minus"
                              mode="outlined"
                              size={16}
                              onPress={() => updateItemQty(item.id, item.quantity, -1)}
                              disabled={qty <= 0}
                            />
                            <Text variant="titleSmall" style={styles.qtyText}>
                              {qty}
                            </Text>
                            <IconButton
                              icon="plus"
                              mode="outlined"
                              size={16}
                              onPress={() => updateItemQty(item.id, item.quantity, 1)}
                              disabled={qty >= item.quantity}
                            />
                          </View>
                        </View>
                      );
                    })
                  )}
                  {hasSelectedItems && (
                    <>
                      <Divider style={styles.divider} />
                      <View style={styles.summaryRow}>
                        <Text variant="bodyMedium">{t('payment.totalToCollect')}</Text>
                        <Text variant="titleMedium" style={styles.bold}>
                          {currencySymbol}
                          {selectedItemsTotal.toFixed(2)}
                        </Text>
                      </View>
                    </>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* Payment Method */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.bold}>
                  {t('payment.paymentMethod')}
                </Text>
                <RadioButton.Group
                  onValueChange={(v) => setMethod(v as 'cash' | 'card' | 'digital')}
                  value={method}
                >
                  <RadioButton.Item label={tCommon('cash')} value="cash" />
                  <RadioButton.Item label={tCommon('card')} value="card" />
                  <RadioButton.Item label={tCommon('digital')} value="digital" />
                </RadioButton.Group>
              </Card.Content>
            </Card>

            {/* Tip — only when the tenant enabled tips */}
            {tipsEnabled && (
              <Card style={styles.card}>
                <Card.Content style={styles.amountSection}>
                  <Text variant="titleMedium" style={styles.bold}>
                    {t('payment.addTip')}
                  </Text>
                  <TextInput
                    label={tCommon('amount')}
                    value={tipAmount}
                    onChangeText={setTipAmount}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    left={<TextInput.Affix text={currencySymbol} />}
                  />
                </Card.Content>
              </Card>
            )}

            <OfflineGuardButton
              mode="contained"
              onPress={handleSubmit}
              loading={createPayment.isPending}
              disabled={submitDisabled}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
              offlineLabel={t('payment.offlineUnavailable')}
            >
              {t('payment.processPaymentBtn')}
            </OfflineGuardButton>
          </>
        )}

        {/* Previous payments */}
        {payments && payments.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.bold}>
                {t('orders.paymentHistory')}
              </Text>
              {payments.map((p) => (
                <View key={p.id} style={styles.paymentItem}>
                  <View>
                    <Text variant="bodyMedium" style={{ textTransform: 'capitalize' }}>
                      {p.payment_method}
                    </Text>
                    <Text variant="bodySmall" style={styles.muted}>
                      {new Date(p.created_at).toLocaleString(locale)}
                    </Text>
                  </View>
                  <Text variant="titleSmall" style={{ color: COLORS.success, fontWeight: '600' }}>
                    {currencySymbol}
                    {p.amount.toFixed(2)}
                  </Text>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {},
  bold: { fontWeight: '700', color: COLORS.textPrimary },
  muted: { color: COLORS.textMuted },
  divider: { marginVertical: 8 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  amountSection: { gap: 12 },
  modeCardContent: { gap: 10 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemInfo: { flex: 1, marginRight: 8 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  qtyText: { minWidth: 20, textAlign: 'center', fontWeight: '700' },
  submitButton: { marginTop: 4 },
  submitButtonContent: { paddingVertical: 6 },
  paymentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
});
