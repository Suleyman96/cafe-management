import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrdersInsert } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import { useCreateOrder } from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text, TextInput } from '@/lib/paper-compat';
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
  const createOrder = useCreateOrder();
  const { data: settings } = useCafeSettings();
  const { showSuccess, showError } = useSnackbar();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(settings?.delivery_fee_default?.toString() || '0');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDeliveryFee(settings?.delivery_fee_default?.toString() || '0');
  }, [settings?.delivery_fee_default]);

  const phoneRegex = /^\+?[\d\s\-()]{7,}$/;
  const isPhoneValid = phoneRegex.test(customerPhone.trim());
  const isValid = customerName.trim() && isPhoneValid && deliveryAddress.trim();

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setDeliveryNotes('');
    setDeliveryFee(settings?.delivery_fee_default?.toString() || '0');
  };

  const handleCreate = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      await createOrder.mutateAsync({
        order_type: 'delivery',
        status: 'new',
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        delivery_address: deliveryAddress.trim(),
        delivery_notes: deliveryNotes.trim() || null,
        delivery_fee: Number.parseFloat(deliveryFee) || 0,
      } as Partial<OrdersInsert> as OrdersInsert);
      showSuccess(t('delivery.orderCreated'));
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : t('delivery.failedCreateOrder'));
    } finally {
      setLoading(false);
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
          <ScrollView>
            <View style={styles.form}>
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
              <View style={styles.hint}>
                <MaterialCommunityIcons name="information" size={16} color={COLORS.purple} />
                <Text variant="bodySmall" style={styles.hintText}>
                  {t('delivery.orderWithoutItems')}
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
            {t('delivery.createOrder')}
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
  titleText: { fontWeight: '700', color: COLORS.textPrimary },
  scrollArea: { paddingHorizontal: 0 },
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
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#f5f3ff',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  hintText: { color: '#6d28d9', flex: 1, fontSize: 12 },
  createBtn: { backgroundColor: COLORS.purple },
});
