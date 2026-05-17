/**
 * @gustri/ui-mobile
 *
 * React Native components and mobile-side utilities consumed by
 * `apps/mobile`. Token primitives (colors, spacing, typography, radii,
 * elevation, shared component prop contracts) live in
 * `@gustri/design-tokens`; web-side components in `@gustri/ui-web`.
 *
 * This package is mobile-only — never depend on it from web apps. It
 * pulls in `react-native`, `react-native-paper`, and `@expo/vector-icons`
 * via peerDependencies + direct deps, which won't resolve in a Next.js
 * SSR pipeline.
 */

// Components
export { Button, type ButtonProps } from './Button';
export { ConfirmDialog } from './ConfirmDialog';
export { DestructiveConfirmModal } from './DestructiveConfirmModal';
export { EmptyState } from './EmptyState';
export { ErrorScreen } from './ErrorScreen';
export { FilterChipBar } from './FilterChipBar';
export { LoadingScreen } from './LoadingScreen';
// Mobile-side utilities — exposed so `apps/mobile` and tests can share the
// same module instance (one `useNow` store across the whole app).
export { __resetNowStoreForTests, useNow, useNowStore } from './lib/now-store';
// Paper-compat is intentionally NOT re-exported from this barrel. Consumers
// (the mobile app's `@/lib/paper-compat` re-export) import from the dedicated
// subpath so the test barrel doesn't pull in `react-native-paper` eagerly.
export { Text, TextInput } from './paper-compat';
export { headerOptions, ScreenHeader, type ScreenHeaderOptions } from './ScreenHeader';
export { Skeleton } from './Skeleton';
export { StatusBadge } from './StatusBadge';
export { TimeElapsed } from './TimeElapsed';
