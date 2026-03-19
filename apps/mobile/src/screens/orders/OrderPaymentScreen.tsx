import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, RadioButton, Text, TextInput } from 'react-native-paper';
import { ErrorScreen, LoadingScreen } from '@/components/ui';
import { useCreatePayment, useOrder, useOrderPayments, useUpdateOrderStatus } from '@/hooks';
import { useSnackbar } from '@/hooks/use-snackbar';
import { useAuthStore } from '@/store/auth-store';
import type { OrdersStackParamList } from '@/types';

type Route = RouteProp<OrdersStackParamList, 'OrderPayment'>;

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'digital', label: 'Digital' },
] as const;

export default function OrderPaymentScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { orderId } = route.params;
  const staff = useAuthStore((s) => s.staff);
  const { showSuccess, showError } = useSnackbar();

  const { data: order, isLoading, error } = useOrder(orderId);
  const { data: payments } = useOrderPayments(orderId);
  const createPayment = useCreatePayment();
  const updateOrderStatus = useUpdateOrderStatus();

  const [method, setMethod] = useState<string>('cash');
  const [amount, setAmount] = useState('');

  const totalPaid = useMemo(
    () => payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0,
    [payments],
  );

  const remaining = (order?.total || 0) - totalPaid;

  const handlePayFull = () => {
    setAmount(remaining.toFixed(2));
  };

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);
    if (Number.isNaN(paymentAmount) || paymentAmount <= 0) {
      showError('Please enter a valid amount');
      return;
    }

    try {
      await createPayment.mutateAsync({
        order_id: orderId,
        amount: paymentAmount,
        payment_method: method as 'cash' | 'card' | 'digital',
        received_by: staff?.id,
      });

      const newRemaining = remaining - paymentAmount;
      if (newRemaining <= 0) {
        await updateOrderStatus.mutateAsync({ orderId, status: 'paid' });
        showSuccess('Payment complete — order paid');
      } else {
        showSuccess(`Payment of $${paymentAmount.toFixed(2)} recorded`);
      }

      navigation.goBack();
    } catch (err: any) {
      showError(err?.message || 'Payment failed');
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (error || !order) return <ErrorScreen error={error || 'Order not found'} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Order Summary */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.bold}>
            Order #{order.order_number || '—'}
          </Text>
          <Divider style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text variant="bodyMedium">Total</Text>
            <Text variant="titleMedium" style={styles.bold}>
              ${(order.total || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text variant="bodyMedium">Already Paid</Text>
            <Text variant="bodyMedium" style={{ color: '#10b981', fontWeight: '600' }}>
              ${totalPaid.toFixed(2)}
            </Text>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text variant="titleMedium" style={styles.bold}>
              Remaining
            </Text>
            <Text
              variant="titleLarge"
              style={{ color: remaining > 0 ? '#ef4444' : '#10b981', fontWeight: '700' }}
            >
              ${remaining.toFixed(2)}
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
                Payment Method
              </Text>
              <RadioButton.Group onValueChange={setMethod} value={method}>
                {PAYMENT_METHODS.map((m) => (
                  <RadioButton.Item key={m.value} label={m.label} value={m.value} />
                ))}
              </RadioButton.Group>
            </Card.Content>
          </Card>

          {/* Amount */}
          <Card style={styles.card}>
            <Card.Content style={styles.amountSection}>
              <TextInput
                label="Amount"
                value={amount}
                onChangeText={setAmount}
                mode="outlined"
                keyboardType="decimal-pad"
                left={<TextInput.Affix text="$" />}
              />
              <Button mode="outlined" onPress={handlePayFull} compact>
                Pay Full (${remaining.toFixed(2)})
              </Button>
            </Card.Content>
          </Card>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={createPayment.isPending}
            disabled={createPayment.isPending || !amount}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
          >
            Process Payment
          </Button>
        </>
      )}

      {/* Previous payments */}
      {payments && payments.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.bold}>
              Payment History
            </Text>
            {payments.map((p: any) => (
              <View key={p.id} style={styles.paymentItem}>
                <View>
                  <Text variant="bodyMedium" style={{ textTransform: 'capitalize' }}>
                    {p.payment_method}
                  </Text>
                  <Text variant="bodySmall" style={styles.muted}>
                    {new Date(p.created_at).toLocaleString()}
                  </Text>
                </View>
                <Text variant="titleSmall" style={{ color: '#10b981', fontWeight: '600' }}>
                  ${p.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {},
  bold: { fontWeight: '700', color: '#1e293b' },
  muted: { color: '#6b7280' },
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
    borderBottomColor: '#f1f5f9',
  },
});
