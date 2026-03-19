import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Modal, Portal, Switch, Text, TextInput } from 'react-native-paper';

interface MenuItemModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: any) => void;
  loading?: boolean;
  initialData?: any;
  categories: any[];
  currencySymbol?: string;
}

export function MenuItemModal({
  visible,
  onDismiss,
  onSubmit,
  loading,
  initialData,
  categories,
  currencySymbol = '$',
}: MenuItemModalProps) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    preparation_time: '',
    is_available: true,
    is_popular: false,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    is_spicy: false,
    is_daily_special: false,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        price: String(initialData.price || ''),
        category_id: initialData.category_id || '',
        preparation_time: String(initialData.preparation_time || ''),
        is_available: initialData.is_available ?? true,
        is_popular: initialData.is_popular ?? false,
        is_vegetarian: initialData.is_vegetarian ?? false,
        is_vegan: initialData.is_vegan ?? false,
        is_gluten_free: initialData.is_gluten_free ?? false,
        is_spicy: initialData.is_spicy ?? false,
        is_daily_special: initialData.is_daily_special ?? false,
      });
    } else {
      setForm({
        name: '',
        description: '',
        price: '',
        category_id: '',
        preparation_time: '',
        is_available: true,
        is_popular: false,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_spicy: false,
        is_daily_special: false,
      });
    }
  }, [initialData]);

  const handleSubmit = () => {
    onSubmit({
      ...form,
      price: parseFloat(form.price) || 0,
      preparation_time: parseInt(form.preparation_time, 10) || null,
      category_id: form.category_id || null,
    });
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <ScrollView>
          <Text variant="titleMedium" style={styles.title}>
            {initialData ? 'Edit Menu Item' : 'New Menu Item'}
          </Text>

          <TextInput
            label="Name"
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Description"
            value={form.description}
            onChangeText={(v) => setForm({ ...form, description: v })}
            mode="outlined"
            dense
            multiline
            style={styles.input}
          />
          <TextInput
            label="Price"
            value={form.price}
            onChangeText={(v) => setForm({ ...form, price: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            left={<TextInput.Affix text={currencySymbol} />}
            dense
            style={styles.input}
          />
          <TextInput
            label="Prep Time (min)"
            value={form.preparation_time}
            onChangeText={(v) => setForm({ ...form, preparation_time: v })}
            mode="outlined"
            keyboardType="number-pad"
            dense
            style={styles.input}
          />

          {categories.length > 0 && (
            <>
              <Text variant="bodySmall" style={styles.label}>
                Category
              </Text>
              <View style={styles.chipRow}>
                {categories.map((c: any) => (
                  <Chip
                    key={c.id}
                    compact
                    selected={form.category_id === c.id}
                    onPress={() => setForm({ ...form, category_id: c.id })}
                  >
                    {c.name || 'Unknown'}
                  </Chip>
                ))}
              </View>
            </>
          )}

          <Text variant="bodySmall" style={styles.label}>
            Flags
          </Text>
          {(
            [
              'is_available',
              'is_popular',
              'is_vegetarian',
              'is_vegan',
              'is_gluten_free',
              'is_spicy',
              'is_daily_special',
            ] as const
          ).map((key) => (
            <View key={key} style={styles.switchRow}>
              <Text variant="bodyMedium">{key.replace(/^is_/, '').replace(/_/g, ' ')}</Text>
              <Switch value={form[key]} onValueChange={(v) => setForm({ ...form, [key]: v })} />
            </View>
          ))}

          <View style={styles.actions}>
            <Button onPress={onDismiss}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={!form.name.trim()}
            >
              {initialData ? 'Update' : 'Create'}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 12, maxHeight: '90%' },
  title: { fontWeight: '700', marginBottom: 12 },
  input: { marginBottom: 8 },
  label: { color: '#6b7280', marginBottom: 4, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
