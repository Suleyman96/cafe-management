import { useTranslation } from '@gustri/i18n';
import type { HiddenCategoryBucket } from '@gustri/queries';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * "+2 items at other stations" coordination strip below the items list of
 * a kitchen card. Tap to expand into a per-category breakdown so the
 * kitchen lead can see at a glance what's being prepared elsewhere on the
 * same order. Renders nothing when there's nothing hidden.
 */
interface HiddenItemsSummaryProps {
  count: number;
  byCategory: HiddenCategoryBucket[];
}

export function HiddenItemsSummary({ count, byCategory }: HiddenItemsSummaryProps) {
  const { t } = useTranslation('staff');
  const [expanded, setExpanded] = useState(false);

  if (count === 0) return null;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.headerText}>{t('kitchen.filter.hiddenItems', { count })}</Text>
      </Pressable>
      {expanded && byCategory.length > 0 && (
        <View style={styles.list}>
          {byCategory.map((bucket) => (
            <View key={bucket.categoryId ?? '__uncategorized__'} style={styles.row}>
              <Text style={styles.bucketName} numberOfLines={1}>
                {bucket.categoryName ?? t('kitchen.filter.uncategorized')}
              </Text>
              <Text style={styles.bucketCount}>×{bucket.count}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pressed: {
    opacity: 0.7,
  },
  chevron: {
    color: '#a3a3a3',
    fontSize: 12,
    width: 12,
    textAlign: 'center',
  },
  headerText: {
    color: '#d1d5db',
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    marginTop: 6,
    paddingLeft: 18,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bucketName: {
    color: '#a3a3a3',
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  bucketCount: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: '700',
  },
});
