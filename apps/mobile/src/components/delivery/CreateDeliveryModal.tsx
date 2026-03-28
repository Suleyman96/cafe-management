import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OrdersInsert } from '@gustri/database';
import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import { useCreateOrder } from '@/hooks';
import { useCafeSettings } from '@/hooks/use-cafe-settings';
import { useSnackbar } from '@/hooks/use-snackbar';
import { Text, TextInput } from '@/lib/paper-compat';

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
  const createOrder = useCreateOrder();
  const { data: settings } = useCafeSettings();
  const { showSuccess, showError } = useSnackbar();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(settings?.delivery_fee_default?.toString() || '0');
  const [loading, setLoading] = useState(false);

  const isValid = customerName.trim() && customerPhone.trim() && deliveryAddress.trim();

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
      showSuccess('Delivery order created');
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : 'Failed to create delivery order');
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
            <MaterialCommunityIcons name="truck-delivery" size={20} color="#7c3aed" />
            <Text variant="titleMedium" style={styles.titleText}>
              New Delivery Order
            </Text>
          </View>
        </Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView>
            <View style={styles.form}>
              <TextInput
                label="Customer Name *"
                value={customerName}
                onChangeText={setCustomerName}
                mode="outlined"
                left={<TextInput.Icon icon="account" />}
              />
              <TextInput
                label="Phone Number *"
                value={customerPhone}
                onChangeText={setCustomerPhone}
                mode="outlined"
                keyboardType="phone-pad"
                left={<TextInput.Icon icon="phone" />}
              />
              <View>
                <TextInput
                  label="Delivery Address *"
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  left={<TextInput.Icon icon="map-marker" />}
                />
                {deliveryAddress.trim() && (
                  <TouchableOpacity onPress={openInMaps} style={styles.mapsLink}>
                    <MaterialCommunityIcons name="google-maps" size={14} color="#7c3aed" />
                    <Text variant="bodySmall" style={styles.mapsText}>
                      View on Maps
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                label="Delivery Notes"
                value={deliveryNotes}
                onChangeText={setDeliveryNotes}
                mode="outlined"
                multiline
                numberOfLines={2}
                left={<TextInput.Icon icon="note-text" />}
              />
              <TextInput
                label="Delivery Fee"
                value={deliveryFee}
                onChangeText={setDeliveryFee}
                mode="outlined"
                keyboardType="numeric"
                left={<TextInput.Icon icon="truck-delivery" />}
              />
              {settings?.delivery_fee_default ? (
                <Text variant="bodySmall" style={styles.defaultFee}>
                  Default: {settings.currency_symbol || '$'}
                  {settings.delivery_fee_default.toFixed(2)}
                </Text>
              ) : null}
              <View style={styles.hint}>
                <MaterialCommunityIcons name="information" size={16} color="#7c3aed" />
                <Text variant="bodySmall" style={styles.hintText}>
                  Order will be created without items. Add items after creation.
                </Text>
              </View>
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={handleDismiss} disabled={loading}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={handleCreate}
            disabled={!isValid || loading}
            loading={loading}
            style={styles.createBtn}
          >
            Create Order
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
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  mapsText: { color: '#7c3aed', fontSize: 11 },
  defaultFee: { color: '#9ca3af', marginTop: -8 },
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
  createBtn: { backgroundColor: '#7c3aed' },
});
