import {
  ORDER_STATUS_HEX,
  ROLE_BADGE_HEX,
  TABLE_STATUS_HEX,
  WAITER_CALL_REASON_HEX,
} from '@gustri/core';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

/** Brand primary color — single source of truth for the teal accent used across the app. */
export const BRAND_PRIMARY = '#367B8B';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: BRAND_PRIMARY,
    primaryContainer: '#d4eff4',
    secondary: '#64748b',
    secondaryContainer: '#f1f5f9',
  },
};

export const kitchenDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#60a5fa',
    primaryContainer: '#1e3a5f',
    surface: '#1a1a1a',
    background: '#111111',
  },
};

export type { StatusColorPair as ColorPair } from '@gustri/core';

// Status colors — single source of truth in @gustri/core
export const ORDER_STATUS_COLORS = ORDER_STATUS_HEX;
export const TABLE_STATUS_COLORS = TABLE_STATUS_HEX;
export const ROLE_COLORS = ROLE_BADGE_HEX;
export const WAITER_CALL_REASON_COLORS = WAITER_CALL_REASON_HEX;

/** Shared card container border-radius — matches staff-web `rounded-lg` (8px). */
export const CARD_RADIUS = 8;

/** Shared card container padding — matches staff-web `p-3` (12px) on mobile. */
export const CARD_PADDING = 12;

/** Typography scale aligned with staff-web Tailwind classes. */
export const TYPOGRAPHY = {
  screenTitle: { fontSize: 22, fontWeight: '700' as const },
  sectionHeader: { fontSize: 18, fontWeight: '600' as const },
  cardTitle: { fontSize: 15, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  meta: { fontSize: 12, fontWeight: '400' as const },
  badge: { fontSize: 11, fontWeight: '600' as const },
};

export const COLORS = {
  // Backgrounds
  background: '#f8fafc',
  card: '#ffffff',

  // Text
  textPrimary: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#6b7280',
  textLight: '#9ca3af',

  // Semantic
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Brand
  brandLight: '#e6f3f5',

  // Borders
  border: '#e2e8f0',
  borderLight: '#f1f5f9',

  // Accents
  purple: '#7c3aed',
  purpleLight: '#8b5cf6',
  indigo: '#6366f1',
  orange: '#ea580c',
} as const;
