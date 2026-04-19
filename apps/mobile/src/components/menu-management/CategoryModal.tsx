import { useTranslation } from '@gustri/i18n';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Modal, Portal, Switch, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import { BRAND_PRIMARY } from '@/theme';

interface CategoryModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (data: any) => void;
  loading?: boolean;
  initialData?: any;
}

const COMMON_ICONS = [
  '📁',
  '☕',
  '🍔',
  '🍕',
  '🍝',
  '🥗',
  '🍰',
  '🥤',
  '🍺',
  '🍷',
  '🍽️',
  '🥐',
  '🍳',
  '🥙',
  '🌮',
];

export function CategoryModal({
  visible,
  onDismiss,
  onSubmit,
  loading,
  initialData,
}: CategoryModalProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: '📁',
    display_order: '0',
    is_active: true,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        icon: initialData.icon || '📁',
        display_order: String(initialData.display_order ?? '0'),
        is_active: initialData.is_active !== false,
      });
    } else {
      setForm({
        name: '',
        description: '',
        icon: '📁',
        display_order: '0',
        is_active: true,
      });
    }
  }, [initialData]);

  const handleSubmit = () => {
    onSubmit({
      ...form,
      display_order: parseInt(form.display_order, 10) || 0,
    });
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <ScrollView>
          <Text variant="titleMedium" style={styles.title}>
            {initialData ? t('menu.editCategory') : t('menu.createCategory')}
          </Text>

          {/* Icon Selector */}
          <Text variant="bodySmall" style={styles.label}>
            {t('menu.icon')}
          </Text>
          <View style={styles.iconGrid}>
            {COMMON_ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                onPress={() => setForm({ ...form, icon })}
                style={[styles.iconBtn, form.icon === icon && styles.iconBtnSelected]}
              >
                <Text style={styles.iconText}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            label={t('menu.customEmoji')}
            value={form.icon}
            onChangeText={(v: string) => setForm({ ...form, icon: v })}
            mode="outlined"
            dense
            style={styles.input}
          />

          <TextInput
            label={t('menu.categoryName')}
            value={form.name}
            onChangeText={(v: string) => setForm({ ...form, name: v })}
            mode="outlined"
            dense
            style={styles.input}
          />
          <TextInput
            label={tCommon('description')}
            value={form.description}
            onChangeText={(v: string) => setForm({ ...form, description: v })}
            mode="outlined"
            dense
            multiline
            style={styles.input}
          />
          <TextInput
            label={t('menu.displayOrder')}
            value={form.display_order}
            onChangeText={(v: string) => setForm({ ...form, display_order: v })}
            mode="outlined"
            keyboardType="number-pad"
            dense
            style={styles.input}
          />

          <View style={styles.switchRow}>
            <Text variant="bodyMedium">{tCommon('active')}</Text>
            <Switch
              value={form.is_active}
              onValueChange={(v: boolean) => setForm({ ...form, is_active: v })}
            />
          </View>

          <View style={styles.actions}>
            <Button onPress={onDismiss}>{tCommon('cancel')}</Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={!form.name.trim()}
            >
              {initialData ? tCommon('update') : tCommon('create')}
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
  label: { color: '#6b7280', marginBottom: 4, marginTop: 4 },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnSelected: {
    borderColor: BRAND_PRIMARY,
    backgroundColor: '#eff6ff',
    borderWidth: 2,
  },
  iconText: { fontSize: 22 },
  input: { marginBottom: 8 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
