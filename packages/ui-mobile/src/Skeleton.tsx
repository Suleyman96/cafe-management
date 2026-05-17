import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';

interface SkeletonProps {
  /** Width in dp, or a percentage string (e.g. '80%'). */
  width?: number | `${number}%`;
  /** Height in dp. */
  height?: number;
  /** Corner radius. Default 6. */
  radius?: number;
  /** Extra style overrides — applied last. */
  style?: ViewStyle;
}

/**
 * Pulsing rectangle stand-in for not-yet-loaded content. Compose into
 * screen-specific skeleton layouts (e.g. a column of skeleton rows)
 * rather than using it as a one-size-fits-all spinner replacement.
 *
 * Animates via `Animated` with `useNativeDriver: true` so the pulse
 * keeps running while the JS thread handles incoming data — important
 * during high-traffic realtime windows when a skeleton is shown most.
 */
export function Skeleton({ width = '100%', height = 16, radius = 6, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.base, { width, height, borderRadius: radius, opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#e5e7eb',
  },
});
