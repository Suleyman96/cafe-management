import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/lib/paper-compat';
import { COLORS } from '@/theme';

interface FilterOption {
  key: string;
  label: string;
  color?: string;
}

interface FilterChipBarProps {
  options: FilterOption[];
  selected: string;
  onSelect: (key: string) => void;
  /** Default color used for selected chips when option.color is not set */
  defaultColor?: string;
}

export const FilterChipBar = React.memo(function FilterChipBar({
  options,
  selected,
  onSelect,
  defaultColor = COLORS.purple,
}: FilterChipBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {options.map((opt) => {
        const isSelected = selected === opt.key;
        const chipColor = opt.color || defaultColor;

        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            style={[styles.chip, isSelected && { backgroundColor: chipColor }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextActive]} numberOfLines={1}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    maxHeight: 52,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    backgroundColor: COLORS.borderLight,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.card,
  },
});
