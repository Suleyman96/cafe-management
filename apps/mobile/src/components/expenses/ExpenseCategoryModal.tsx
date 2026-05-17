import { useTranslation } from '@gustri/i18n';
import { ConfirmDialog } from '@gustri/ui-mobile';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Divider, IconButton, Modal, Portal, Text } from 'react-native-paper';
import { TextInput } from '@/lib/paper-compat';
import { COLORS } from '@/theme';

interface ExpenseCategoryModalProps {
  visible: boolean;
  onDismiss: () => void;
  categories: { id: string; name: string; description?: string | null }[];
  onCreate: (data: { name: string; description?: string }) => void;
  onUpdate: (id: string, data: { name: string; description?: string }) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function ExpenseCategoryModal({
  visible,
  onDismiss,
  categories,
  onCreate,
  onUpdate,
  onDelete,
  loading,
}: ExpenseCategoryModalProps) {
  const { t } = useTranslation('staff');
  const { t: tCommon } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setShowForm(false);
      setEditId(null);
      setName('');
      setDescription('');
    }
  }, [visible]);

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setName('');
    setDescription('');
  };

  const handleEdit = (cat: { id: string; name: string; description?: string | null }) => {
    setEditId(cat.id);
    setName(cat.name);
    setDescription(cat.description || '');
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (editId) {
      onUpdate(editId, { name: name.trim(), description: description.trim() || undefined });
    } else {
      onCreate({ name: name.trim(), description: description.trim() || undefined });
    }
    resetForm();
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <Text variant="titleMedium" style={styles.title}>
          {t('expenses.manageCategories')}
        </Text>

        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={Divider}
          style={styles.list}
          renderItem={({ item }) => (
            <View style={styles.categoryRow}>
              <View style={styles.categoryInfo}>
                <Text variant="bodyMedium" style={styles.categoryName}>
                  {item.name}
                </Text>
                {item.description && (
                  <Text variant="bodySmall" style={styles.categoryDesc}>
                    {item.description}
                  </Text>
                )}
              </View>
              <View style={styles.categoryActions}>
                <IconButton icon="pencil" size={18} onPress={() => handleEdit(item)} />
                <IconButton
                  icon="delete"
                  size={18}
                  iconColor={COLORS.danger}
                  onPress={() => setDeleteId(item.id)}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text variant="bodySmall" style={styles.emptyText}>
              {t('expenses.noCategoriesYet')}
            </Text>
          }
        />

        <Divider style={styles.divider} />

        {showForm ? (
          <View style={styles.formSection}>
            <Text variant="bodySmall" style={styles.formLabel}>
              {editId ? t('expenses.editCategory') : t('expenses.newCategory')}
            </Text>
            <TextInput
              label={t('expenses.nameRequired')}
              value={name}
              onChangeText={setName}
              mode="outlined"
              dense
              style={styles.input}
            />
            <TextInput
              label={tCommon('description')}
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              dense
              style={styles.input}
            />
            <View style={styles.formActions}>
              <Button compact onPress={resetForm}>
                {tCommon('cancel')}
              </Button>
              <Button
                compact
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={!name.trim()}
              >
                {editId ? tCommon('update') : tCommon('add')}
              </Button>
            </View>
          </View>
        ) : (
          <Button
            mode="outlined"
            icon="plus"
            onPress={() => setShowForm(true)}
            style={styles.addBtn}
          >
            {t('expenses.addCategory')}
          </Button>
        )}

        <View style={styles.closeRow}>
          <Button onPress={onDismiss}>{tCommon('close')}</Button>
        </View>

        <ConfirmDialog
          visible={!!deleteId}
          title={t('expenses.deleteCategory')}
          message={t('expenses.deleteCategoryConfirm')}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteId(null)}
          destructive
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: COLORS.card,
    margin: 16,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  title: { fontWeight: '700', marginBottom: 12 },
  list: { maxHeight: 250 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  categoryInfo: { flex: 1, gap: 2 },
  categoryName: { fontWeight: '600', color: COLORS.textPrimary },
  categoryDesc: { color: COLORS.textMuted },
  categoryActions: { flexDirection: 'row' },
  emptyText: { color: COLORS.textLight, textAlign: 'center', paddingVertical: 16 },
  divider: { marginVertical: 12 },
  formSection: { gap: 4 },
  formLabel: { color: COLORS.textMuted, marginBottom: 4 },
  input: { marginBottom: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  addBtn: { borderColor: COLORS.border },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
});
