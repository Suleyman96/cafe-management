import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from '@gustri/i18n';
import React from 'react';
import { Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Switch } from 'react-native-paper';
import { Text, TextInput } from '@/lib/paper-compat';
import { COLORS } from '@/theme';

interface DeliveryCustomerFormProps {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (value: string) => void;
  isPhoneValid: boolean;
  deliveryAddress: string;
  onDeliveryAddressChange: (value: string) => void;
  deliveryNotes: string;
  onDeliveryNotesChange: (value: string) => void;
  deliveryFee: string;
  onDeliveryFeeChange: (value: string) => void;
  defaultDeliveryFee: number | null | undefined;
  defaultCurrencySymbol: string;
  saveCustomer: boolean;
  onSaveCustomerChange: (value: boolean) => void;
}

/**
 * Customer/delivery fields for the create-delivery modal: name, phone (with
 * inline validation state), address (+ open-in-maps shortcut), notes, delivery
 * fee, and the save-customer toggle. Validation rules live in the parent modal;
 * this component renders the `isPhoneValid` result it's given.
 */
export const DeliveryCustomerForm = React.memo(function DeliveryCustomerForm({
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  isPhoneValid,
  deliveryAddress,
  onDeliveryAddressChange,
  deliveryNotes,
  onDeliveryNotesChange,
  deliveryFee,
  onDeliveryFeeChange,
  defaultDeliveryFee,
  defaultCurrencySymbol,
  saveCustomer,
  onSaveCustomerChange,
}: DeliveryCustomerFormProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');

  const openInMaps = () => {
    if (deliveryAddress.trim()) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(deliveryAddress.trim())}`;
      Linking.openURL(url);
    }
  };

  return (
    <>
      <TextInput
        label={t('delivery.customerName')}
        value={customerName}
        onChangeText={onCustomerNameChange}
        mode="outlined"
        left={<TextInput.Icon icon="account" />}
      />
      <TextInput
        label={t('delivery.phoneNumber')}
        value={customerPhone}
        onChangeText={onCustomerPhoneChange}
        mode="outlined"
        keyboardType="phone-pad"
        left={<TextInput.Icon icon="phone" />}
        error={!!customerPhone.trim() && !isPhoneValid}
      />
      <View>
        <TextInput
          label={t('delivery.deliveryAddress')}
          value={deliveryAddress}
          onChangeText={onDeliveryAddressChange}
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
        onChangeText={onDeliveryNotesChange}
        mode="outlined"
        multiline
        numberOfLines={2}
        left={<TextInput.Icon icon="note-text" />}
      />
      <TextInput
        label={tCommon('deliveryFee')}
        value={deliveryFee}
        onChangeText={onDeliveryFeeChange}
        mode="outlined"
        keyboardType="numeric"
        left={<TextInput.Icon icon="truck-delivery" />}
      />
      {defaultDeliveryFee != null ? (
        <Text variant="bodySmall" style={styles.defaultFee}>
          {t('delivery.defaultLabel')} {defaultCurrencySymbol}
          {defaultDeliveryFee.toFixed(2)}
        </Text>
      ) : null}

      {/* Save customer toggle */}
      <View style={styles.toggleRow}>
        <Text variant="bodyMedium" style={styles.toggleLabel}>
          {t('delivery.saveCustomer')}
        </Text>
        <Switch value={saveCustomer} onValueChange={onSaveCustomerChange} />
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  mapsText: { color: COLORS.purple, fontSize: 11 },
  defaultFee: { color: COLORS.textLight, marginTop: -8 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: { flex: 1, color: COLORS.textPrimary },
});
