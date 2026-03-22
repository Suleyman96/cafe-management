/**
 * Shared style constants for the dark glass UI theme.
 * Use these in inline `style={{}}` props to avoid duplicating rgba strings.
 */

// ─── Glass Surface Colors ───────────────────────────────────────────────────

export const GLASS = {
  subtle: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.06)',
  light: 'rgba(255,255,255,0.08)',
  medium: 'rgba(255,255,255,0.1)',
} as const;

// ─── Reusable Style Objects ─────────────────────────────────────────────────

/** Card-like glass surface: subtle background + thin border */
export const glassCardStyle = {
  background: GLASS.subtle,
  border: `1px solid ${GLASS.border}`,
} as const;

/** Interactive control surface (buttons, inputs): slightly brighter */
export const glassControlStyle = {
  background: GLASS.light,
  border: `1px solid ${GLASS.medium}`,
} as const;

/** Section divider border */
export const glassBorderStyle = {
  borderTop: `1px solid ${GLASS.border}`,
} as const;

// ─── Accent Helpers ─────────────────────────────────────────────────────────

/** Gradient button style for the accent color */
export function accentButtonStyle(color: string) {
  return {
    background: `linear-gradient(135deg, ${color}, ${color}dd)`,
    color: '#0C0C0E',
    boxShadow: `0 4px 20px ${color}30`,
  } as const;
}

/** Accent pill style (category pills, badges) */
export function accentPillStyle(color: string) {
  return {
    background: `linear-gradient(135deg, ${color}, ${color}dd)`,
    color: '#0C0C0E',
    boxShadow: `0 2px 12px ${color}30`,
  } as const;
}

/** Inactive pill style */
export const inactivePillStyle = {
  background: GLASS.border,
  color: 'rgba(255,255,255,0.6)',
  border: `1px solid ${GLASS.light}`,
} as const;
