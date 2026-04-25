// Stub for react-native — Rolldown/Vitest cannot parse Flow syntax in the real package
export const Platform = { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios };
export const Alert = { alert: () => {} };
export const AppState = { currentState: 'active', addEventListener: () => ({ remove: () => {} }) };
export const Dimensions = { get: () => ({ width: 375, height: 812 }) };
export const StyleSheet = { create: <T extends Record<string, unknown>>(s: T) => s };
export const NativeModules = {};
export const PixelRatio = { get: () => 2, roundToNearestPixel: (v: number) => v };
export const I18nManager = { isRTL: false };
export const Linking = {
  openURL: () => Promise.resolve(),
  canOpenURL: () => Promise.resolve(true),
};
export default {
  Platform,
  Alert,
  AppState,
  Dimensions,
  StyleSheet,
  NativeModules,
  PixelRatio,
  I18nManager,
  Linking,
};
