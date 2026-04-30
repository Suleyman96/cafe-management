import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrdersInsert } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import { useCreateOrder } from '@/hooks/local';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text, TextInput } from '@/lib/paper-compat';

interface CreateTakeoutModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSuccess: () => void;
}

export const CreateTakeoutModal = React.memo(function CreateTakeoutModal({
  visible,
  onDismiss,
  onSuccess,
}: CreateTakeoutModalProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const createOrder = useCreateOrder();
  const { showSuccess, showError } = useSnackbar();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = customerName.trim() && customerPhone.trim();

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerNotes('');
  };

  const handleCreate = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      await createOrder.mutateAsync({
        order_type: 'takeout',
        status: 'new',
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_notes: customerNotes.trim() || null,
      } as Partial<OrdersInsert> as OrdersInsert);
      showSuccess(t('takeout.takeoutOrderCreated'));
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      showError(err instanceof Error ? err : t('takeout.failedCreateTakeout'));
    } finally {
      setLoading(false);
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
            <MaterialCommunityIcons name="shopping" size={20} color="#ea580c" />
            <Text variant="titleMedium" style={styles.titleText}>
              {t('takeout.newTakeoutOrder')}
            </Text>
          </View>
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <View style={styles.form}>
              <TextInput
                label={t('takeout.customerName')}
                value={customerName}
                onChangeText={setCustomerName}
                mode="outlined"
                left={<TextInput.Icon icon="account" />}
              />
              <TextInput
                label={t('takeout.phoneNumber')}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                mode="outlined"
                keyboardType="phone-pad"
                left={<TextInput.Icon icon="phone" />}
              />
              <TextInput
                label={tCommon('notes')}
                value={customerNotes}
                onChangeText={setCustomerNotes}
                mode="outlined"
                multiline
                numberOfLines={2}
                left={<TextInput.Icon icon="note-text" />}
              />
              <View style={styles.hint}>
                <MaterialCommunityIcons name="information" size={16} color="#ea580c" />
                <Text variant="bodySmall" style={styles.hintText}>
                  {t('takeout.orderWithoutItems')}
                </Text>
              </View>
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={handleDismiss} disabled={loading}>
            {tCommon('cancel')}
          </Button>
          <Button
            mode="contained"
            onPress={handleCreate}
            disabled={!isValid || loading}
            loading={loading}
            style={styles.createBtn}
          >
            {t('takeout.createOrder')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
});

const styles = StyleSheet.create({
  dialog: { maxHeight: '85%' },
  title: { paddingBottom: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontWeight: '700', color: '#1e293b' },
  scrollArea: { paddingHorizontal: 0 },
  form: { gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#fff7ed',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  hintText: { color: '#c2410c', flex: 1, fontSize: 12 },
  createBtn: { backgroundColor: '#ea580c' },
});
