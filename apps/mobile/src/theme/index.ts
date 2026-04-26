import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

/** Brand primary color — single source of truth for the teal accent used across the app. */
export const BRAND_PRIMARY = '#367B8B';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2563eb',
    primaryContainer: '#dbeafe',
    secondary: '#7c3aed',
    secondaryContainer: '#ede9fe',
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

export type ColorPair = { bg: string; text: string };

export const ORDER_STATUS_COLORS: Record<string, ColorPair> = {
  pending_approval: { bg: '#fef3c7', text: '#92400e' }, // amber-100 / amber-800
  new: { bg: '#d4eff4', text: '#274856' }, // custom blue-100 / blue-800
  preparing: { bg: '#fef9c3', text: '#854d0e' }, // yellow-100 / yellow-800
  ready: { bg: '#dcfce7', text: '#166534' }, // green-100 / green-800
  served: { bg: '#ede9fe', text: '#6b21a8' }, // purple-100 / purple-800
  out_for_delivery: { bg: '#ede9fe', text: '#5b21b6' }, // violet-100 / violet-800
  delivered: { bg: '#d1fae5', text: '#065f46' }, // emerald-100 / emerald-800
  cancelled: { bg: '#fee2e2', text: '#991b1b' }, // red-100 / red-800
  closed: { bg: '#f3f4f6', text: '#1f2937' }, // gray-100 / gray-800
};

export const TABLE_STATUS_COLORS: Record<string, ColorPair> = {
  free: { bg: '#f3f4f6', text: '#4b5563' }, // gray-100 / gray-600
  occupied: { bg: '#ffedd5', text: '#9a3412' }, // orange-100 / orange-800
  reserved: { bg: '#d4eff4', text: '#274856' }, // custom blue-100 / blue-800
  closed: { bg: '#e5e7eb', text: '#4b5563' }, // gray-200 / gray-600
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

export const ROLE_COLORS: Record<string, ColorPair> = {
  owner: { bg: '#d1fae5', text: '#065f46' }, // emerald-100 / emerald-800
  admin: { bg: '#ede9fe', text: '#6b21a8' }, // purple-100 / purple-800
  kitchen: { bg: '#ffedd5', text: '#9a3412' }, // orange-100 / orange-800
  waiter: { bg: '#d4eff4', text: '#274856' }, // custom blue-100 / blue-800
};

export const WAITER_CALL_REASON_COLORS: Record<string, string> = {
  emergency: '#ef4444',
  complaint: '#f97316',
  bill: '#10b981',
  question: BRAND_PRIMARY,
  assistance: '#6b7280',
};
