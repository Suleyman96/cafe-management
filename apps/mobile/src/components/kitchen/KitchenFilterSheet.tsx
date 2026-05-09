import type { Category } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { useReplaceStaffKitchenFilters, useStaffKitchenFilters } from '@gustri/queries';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Modal, Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_PRIMARY, COLORS, TYPOGRAPHY } from '@/theme';

/**
 * Bottom-sheet drawer that lets a kitchen-screen user pick which menu
 * categories appear on this device. Same semantics as the staff-web drawer:
 * each chip toggle commits immediately (optimistic via the shared hook),
 * "Show all" clears the filter, "Done" closes the sheet.
 *
 * Implemented with `react-native-paper` Modal + Portal because that's the
 * existing modal pattern in this app — no extra dependency. Styled to feel
 * like a bottom sheet (sliding up from the bottom of the viewport, rounded
 * top corners, safe-area aware).
 */
interface KitchenFilterSheetProps {
  visible: boolean;
  onDismiss: () => void;
  staffId: string;
  categories: Category[];
}

export function KitchenFilterSheet({
  visible,
  onDismiss,
  staffId,
  categories,
}: KitchenFilterSheetProps) {
  const { t } = useTranslation('staff');
  const insets = useSafeAreaInsets();
  const { data: filterCategoryIds } = useStaffKitchenFilters(staffId);
  const replace = useReplaceStaffKitchenFilters();

  const [selected, setSelected] = useState<Set<string>>(() => new Set(filterCategoryIds ?? []));

  useEffect(() => {
    setSelected(new Set(filterCategoryIds ?? []));
  }, [filterCategoryIds]);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return a.name.localeCompare(b.name);
      }),
    [categories],
  );

  const toggle = (categoryId: string) => {
    const next = new Set(selected);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    setSelected(next);
    replace.mutate({ staffId, categoryIds: [...next] });
  };

  const clearAll = () => {
    setSelected(new Set());
    replace.mutate({ staffId, categoryIds: [] });
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}
      >
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>
        <Text style={styles.title}>{t('kitchen.filter.title')}</Text>
        <Text style={styles.subtitle}>{t('kitchen.filter.subtitle')}</Text>

        {sortedCategories.length === 0 ? (
          <Text style={styles.emptyText}>{t('kitchen.filter.noCategoriesYet')}</Text>
        ) : (
          <ScrollView
            contentContainerStyle={styles.chipGrid}
            showsVerticalScrollIndicator={false}
            style={styles.chipScroll}
          >
            {sortedCategories.map((category) => {
              const isSelected = selected.has(category.id);
              return (
                <Pressable
                  key={category.id}
                  onPress={() => toggle(category.id)}
                  style={({ pressed }) => [
                    styles.chip,
                    isSelected ? styles.chipSelected : styles.chipUnselected,
                    pressed && styles.chipPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={isSelected ? styles.chipTextSelected : styles.chipTextUnselected}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.actions}>
          <Pressable
            onPress={clearAll}
            style={({ pressed }) => [styles.actionBtn, styles.clearBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.clearBtnText}>{t('kitchen.filter.clear')}</Text>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.actionBtn, styles.doneBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.doneBtnText}>{t('kitchen.filter.done')}</Text>
          </Pressable>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#1f1f1f',
    marginHorizontal: 0,
    marginTop: 'auto',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '80%',
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#525252',
  },
  title: {
    ...TYPOGRAPHY.sectionHeader,
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: '#a3a3a3',
    marginBottom: 16,
  },
  chipScroll: {
    maxHeight: 320,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 2,
  },
  chipSelected: {
    backgroundColor: BRAND_PRIMARY,
    borderColor: BRAND_PRIMARY,
  },
  chipUnselected: {
    backgroundColor: '#2a2a2a',
    borderColor: '#525252',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  chipTextUnselected: {
    color: '#e5e7eb',
    fontWeight: '500',
    fontSize: 14,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: 24,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearBtn: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#525252',
  },
  clearBtnText: {
    color: '#e5e7eb',
    fontWeight: '600',
    fontSize: 14,
  },
  doneBtn: {
    backgroundColor: '#fff',
  },
  doneBtnText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
});
