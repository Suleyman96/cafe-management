/**
 * Shared typography scale.
 *
 * Mobile imports `TYPOGRAPHY` directly into `StyleSheet`. Web matches by
 * convention via Tailwind's text-size utilities (`text-sm` ≈ 14px, etc.) —
 * the rendered sizes are aligned with what these entries describe.
 */
export const TYPOGRAPHY = {
  screenTitle: { fontSize: 22, fontWeight: '700' as const },
  sectionHeader: { fontSize: 18, fontWeight: '600' as const },
  cardTitle: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  meta: { fontSize: 12, fontWeight: '400' as const },
  badge: { fontSize: 11, fontWeight: '600' as const },
} as const;

export type TypographyToken = keyof typeof TYPOGRAPHY;
