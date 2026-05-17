/**
 * Shared spacing scale.
 *
 * Mirrored on web as a Tailwind theme extension (see each app's
 * tailwind.config) so `gap-md`, `p-lg`, etc. resolve to the same pixel
 * values as `style={{ padding: SPACING.lg }}` on mobile. Numeric (not
 * strings with `px` suffix) so React Native's `StyleSheet` accepts the
 * values directly.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export type SpacingToken = keyof typeof SPACING;
