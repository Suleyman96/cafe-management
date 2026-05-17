/**
 * Stub for `react-native-safe-area-context` — the real package ships
 * Flow + native bridge code that Vitest cannot parse. Tests don't render
 * inside a SafeAreaProvider tree, so `useSafeAreaInsets()` returns a
 * zeroed result that's still a valid `EdgeInsets` shape.
 */
export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const useSafeAreaFrame = () => ({ x: 0, y: 0, width: 375, height: 812 });
export const SafeAreaProvider = ({ children }: { children?: unknown }) => children as never;
export const SafeAreaView = ({ children }: { children?: unknown }) => children as never;
export const SafeAreaInsetsContext = { Consumer: () => null, Provider: () => null };
export const SafeAreaFrameContext = { Consumer: () => null, Provider: () => null };
