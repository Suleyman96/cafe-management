import { ConflictError } from '@gustri/core';
import { useLocale, useTranslation } from '@gustri/i18n';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, RadioButton, Text } from 'react-native-paper';
import { OfflineGuardButton } from '@/components/OfflineGuardButton';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCreatePayment, useCurrencySymbol, useOrder, useUpdateOrderStatus } from '@/hooks/local';
import { useOrderPayments } from '@/hooks/shared';
import { useSnackbar } from '@/hooks/use-snackbar';
import { TextInput } from '@/lib/paper-compat';
import { useAuthStore } from '@/store/auth-store';
import { COLORS } from '@/theme';
import type { OrdersStackParamList } from '@/types';

type Route = RouteProp<OrdersStackParamList, 'OrderPayment'>;

export default function OrderPaymentScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { orderId } = route.params;
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();

  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const locale = useLocale();

  const paymentMethods = useMemo(
    () => [
      { value: 'cash', label: tCommon('cash') },
      { value: 'card', label: tCommon('card') },
      { value: 'digital', label: tCommon('digital') },
    ],
    [tCommon],
  );

  const { data: order, isLoading, error, refetch } = useOrder(orderId);
  const { data: payments, refetch: refetchPayments } = useOrderPayments(orderId);
  const createPayment = useCreatePayment();
  const updateOrderStatus = useUpdateOrderStatus();
  const currencySymbol = useCurrencySymbol();
  const [method, setMethod] = useState<string>('cash');
  const [amount, setAmount] = useState('');

  const totalPaid = useMemo(
    () => payments?.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0) || 0,
    [payments],
  );

  const remaining = (order?.total ?? 0) - totalPaid;

  const handlePayFull = () => {
    setAmount(remaining.toFixed(2));
  };

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);
    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      showError(t('payment.validAmount'));
      return;
    }

    if (paymentAmount > remaining) {
      showError(t('payment.exceedsRemaining'));
      return;
    }

    if (!staff?.id) {
      showError(t('payment.notAuthenticated'));
      return;
    }

    try {
      await createPayment.mutateAsync({
        order_id: orderId,
        amount: paymentAmount,
        payment_method: method as 'cash' | 'card' | 'digital',
        received_by: staff.id,
      });

      const newRemaining = remaining - paymentAmount;
      if (newRemaining <= 0) {
        await updateOrderStatus.mutateAsync({ orderId, status: 'closed' });
        showSuccess(t('orders.paymentProcessed'));
      } else {
        showSuccess(
          t('payment.paymentRecorded', { amount: `${currencySymbol}${paymentAmount.toFixed(2)}` }),
        );
      }

      navigation.goBack();
    } catch (err: unknown) {
      // 409 (ConflictError) is what the server returns when the payment
      // would exceed the remaining balance — typically because another
      // cashier already charged this order while this screen was open.
      // Refetch order + payments so the staff sees the actual remaining
      // balance before retrying. The localized sentinel message that comes
      // back already tells them to refresh; this just does it for them.
      if (err instanceof ConflictError) {
        refetch();
        refetchPayments();
      }
      showError(err instanceof Error ? err : t('payment.paymentFailed'));
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !order)
    return <ErrorScreen error={error || t('orders.orderNotFound')} onRetry={refetch} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
              {(order.total ?? 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodyMedium">{t('payment.alreadyPaid')}</Text>
            <Text variant="bodyMedium" style={{ color: COLORS.success, fontWeight: '600' }}>
              {currencySymbol}
              {totalPaid.toFixed(2)}
            </Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text variant="titleMedium" style={styles.bold}>
              {t('orders.remaining')}
            </Text>
            <Text
              variant="titleLarge"
              style={{ color: remaining > 0 ? COLORS.danger : COLORS.success, fontWeight: '700' }}
            >
              {currencySymbol}
              {remaining.toFixed(2)}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {remaining > 0 && (
        <>
          {/* Payment Method */}
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.bold}>
                {t('payment.paymentMethod')}
              </Text>
              <RadioButton.Group onValueChange={setMethod} value={method}>
                {paymentMethods.map((m) => (
                  <RadioButton.Item key={m.value} label={m.label} value={m.value} />
                ))}
              </RadioButton.Group>
            </Card.Content>
          </Card>

          {/* Amount */}
          <Card style={styles.card}>
            <Card.Content style={styles.amountSection}>
              <TextInput
                label={tCommon('amount')}
                value={amount}
                onChangeText={setAmount}
                mode="outlined"
                keyboardType="decimal-pad"
                left={<TextInput.Affix text={currencySymbol} />}
              />
              <Button mode="outlined" onPress={handlePayFull} compact>
                {t('payment.payFull', { amount: `${currencySymbol}${remaining.toFixed(2)}` })}
              </Button>
            </Card.Content>
          </Card>

          <OfflineGuardButton
            mode="contained"
            onPress={handleSubmit}
            loading={createPayment.isPending}
            disabled={createPayment.isPending || !amount}
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
            {payments.map(
              (p: { id: string; payment_method: string; amount: number; created_at: string }) => (
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
              ),
            )}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
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
