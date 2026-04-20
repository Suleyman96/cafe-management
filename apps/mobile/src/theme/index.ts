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

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending_approval: '#f97316',
  new: BRAND_PRIMARY,
  preparing: '#f59e0b',
  ready: '#10b981',
  served: '#06b6d4',
  closed: '#6b7280',
  cancelled: '#ef4444',
  out_for_delivery: '#7c3aed',
  delivered: '#10b981',
};

export const TABLE_STATUS_COLORS: Record<string, string> = {
  free: '#10b981',
  occupied: '#f59e0b',
  reserved: BRAND_PRIMARY,
  closed: '#6b7280',
};

export const WAITER_CALL_REASON_COLORS: Record<string, string> = {
  emergency: '#ef4444',
  complaint: '#f97316',
  bill: '#10b981',
  question: BRAND_PRIMARY,
  assistance: '#6b7280',
};
