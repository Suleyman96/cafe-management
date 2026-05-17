/**
 * Mobile `Button` — satisfies `ButtonContract` from `@gustri/design-tokens`,
 * so a waiter switching between web and mobile gets the same vocabulary
 * (`variant="destructive"` paints red on both surfaces). Implemented over
 * `TouchableOpacity` rather than `react-native-paper`'s Button so the
 * variant matrix matches web's CVA contract exactly — Paper's mode-based
 * API (`contained` / `outlined` / `text`) doesn't line up with web's
 * five-variant set without adapter cruft.
 */
import { BRAND_PRIMARY, type ButtonContract, SEMANTIC_COLORS } from '@gustri/design-tokens';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ButtonProps extends ButtonContract {
  /** Button label. */
  children?: React.ReactNode;
  /** Tap handler. */
  onPress?: () => void;
  /** Optional leading icon — a React element (typically
   * `<MaterialCommunityIcons name="…">`). */
  icon?: React.ReactNode;
  /** Optional accessibility label override (defaults to children if string). */
  accessibilityLabel?: string;
}

type Palette = {
  bg: string;
  text: string;
  border?: string;
};

const VARIANT_PALETTE: Record<NonNullable<ButtonContract['variant']>, Palette> = {
  primary: { bg: BRAND_PRIMARY, text: '#fff' },
  secondary: { bg: '#e5e7eb', text: SEMANTIC_COLORS.textPrimary },
  outline: { bg: 'transparent', text: BRAND_PRIMARY, border: BRAND_PRIMARY },
  ghost: { bg: 'transparent', text: BRAND_PRIMARY },
  destructive: { bg: SEMANTIC_COLORS.danger, text: '#fff' },
};

const SIZE_STYLES: Record<
  NonNullable<ButtonContract['size']>,
  { padV: number; padH: number; font: number; minH: number }
> = {
  sm: { padV: 6, padH: 12, font: 13, minH: 32 },
  md: { padV: 10, padH: 16, font: 14, minH: 40 },
  lg: { padV: 14, padH: 20, font: 16, minH: 48 },
  // `icon` is a square footprint for a leading icon with no label.
  icon: { padV: 8, padH: 8, font: 14, minH: 40 },
};

export const Button = React.memo(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  children,
  onPress,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const palette = VARIANT_PALETTE[variant];
  const sizeStyle = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.btn,
    {
      backgroundColor: palette.bg,
      paddingVertical: sizeStyle.padV,
      paddingHorizontal: sizeStyle.padH,
      minHeight: sizeStyle.minH,
    },
    palette.border ? { borderColor: palette.border, borderWidth: 1.5 } : null,
    isDisabled && styles.disabled,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (typeof children === 'string' ? children : undefined)
      }
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.text} />
      ) : (
        <View style={styles.inner}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          {children ? (
            <Text style={[styles.label, { color: palette.text, fontSize: sizeStyle.font }]}>
              {children}
            </Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  btn: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  label: {
    fontWeight: '600',
  },
});
