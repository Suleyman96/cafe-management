import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Modal, Portal, Switch, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';

interface MenuItemModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: any) => void;
  loading?: boolean;
  initialData?: any;
  categories: any[];
  currencySymbol?: string;
}

const COMMON_ALLERGENS = ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Fish', 'Shellfish', 'Sesame'];

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
    display_order: '0',
    is_available: true,
    is_popular: false,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    is_spicy: false,
    is_daily_special: false,
    allergens: [] as string[],
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        price: String(initialData.price || ''),
        category_id: initialData.category_id || '',
        preparation_time: String(initialData.preparation_time || ''),
        display_order: String(initialData.display_order ?? '0'),
        is_available: initialData.is_available ?? true,
        is_popular: initialData.is_popular ?? false,
        is_vegetarian: initialData.is_vegetarian ?? false,
        is_vegan: initialData.is_vegan ?? false,
        is_gluten_free: initialData.is_gluten_free ?? false,
        is_spicy: initialData.is_spicy ?? false,
        is_daily_special: initialData.is_daily_special ?? false,
        allergens: initialData.allergens || [],
      });
    } else {
      setForm({
        name: '',
        description: '',
        price: '',
        category_id: '',
        preparation_time: '',
        display_order: '0',
        is_available: true,
        is_popular: false,
        is_vegetarian: false,
        is_vegan: false,
        is_gluten_free: false,
        is_spicy: false,
        is_daily_special: false,
        allergens: [],
      });
    }
  }, [initialData]);

  const toggleAllergen = (allergen: string) => {
    setForm((prev) => ({
      ...prev,
      allergens: prev.allergens.includes(allergen)
        ? prev.allergens.filter((a) => a !== allergen)
        : [...prev.allergens, allergen],
    }));
  };

  const handleSubmit = () => {
    onSubmit({
      ...form,
      price: parseFloat(form.price) || 0,
      preparation_time: parseInt(form.preparation_time, 10) || null,
      display_order: parseInt(form.display_order, 10) || 0,
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
            label="Name *"
            value={form.name}
            onChangeText={(v: string) => setForm({ ...form, name: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label="Description"
            value={form.description}
            onChangeText={(v: string) => setForm({ ...form, description: v })}
            mode="outlined"
            dense
            multiline
            style={styles.input}
          />
          <TextInput
            label="Price *"
            value={form.price}
            onChangeText={(v: string) => setForm({ ...form, price: v })}
            mode="outlined"
            keyboardType="decimal-pad"
            left={<TextInput.Affix text={currencySymbol} />}
            dense
            style={styles.input}
          />
          <View style={styles.rowInputs}>
            <TextInput
              label="Prep Time (min)"
              value={form.preparation_time}
              onChangeText={(v: string) => setForm({ ...form, preparation_time: v })}
              mode="outlined"
              keyboardType="number-pad"
              dense
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              label="Display Order"
              value={form.display_order}
              onChangeText={(v: string) => setForm({ ...form, display_order: v })}
              mode="outlined"
              keyboardType="number-pad"
              dense
              style={[styles.input, styles.halfInput]}
            />
          </View>

          {categories.length > 0 && (
            <>
              <Text variant="bodySmall" style={styles.label}>
                Category
              </Text>
              <View style={styles.chipRow}>
                <Chip
                  compact
                  selected={!form.category_id}
                  onPress={() => setForm({ ...form, category_id: '' })}
                >
                  None
                </Chip>
                {categories.map((c: any) => (
                  <Chip
                    key={c.id}
                    compact
                    selected={form.category_id === c.id}
                    onPress={() => setForm({ ...form, category_id: c.id })}
                  >
                    {c.icon || '📁'} {c.name || 'Unknown'}
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
              <Switch
                value={form[key]}
                onValueChange={(v: boolean) => setForm({ ...form, [key]: v })}
              />
            </View>
          ))}

          {/* Allergens */}
          <Text variant="bodySmall" style={styles.label}>
            Allergens
          </Text>
          <View style={styles.chipRow}>
            {COMMON_ALLERGENS.map((allergen) => (
              <Chip
                key={allergen}
                compact
                selected={form.allergens.includes(allergen)}
                onPress={() => toggleAllergen(allergen)}
                style={form.allergens.includes(allergen) ? styles.allergenSelected : undefined}
                textStyle={
                  form.allergens.includes(allergen)
                    ? { color: '#fff', fontSize: 11 }
                    : { fontSize: 11 }
                }
              >
                {allergen}
              </Chip>
            ))}
          </View>

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
  rowInputs: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  label: { color: '#6b7280', marginBottom: 4, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  allergenSelected: { backgroundColor: '#ef4444' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
