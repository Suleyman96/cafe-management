import React, { Suspense } from 'react';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

type ScreenLoader<P> = () => Promise<{ default: React.ComponentType<P> }>;

/**
 * Wraps a dynamic-imported screen so it can be passed directly to a Stack/Drawer
 * `component` prop. The Suspense boundary lives inside the wrapper so React
 * Navigation never sees the LazyExoticComponent — it sees a plain function
 * component that suspends internally on first focus.
 *
 * Used to keep drawer-only screens (MenuManagement, Reports, Stock, etc.) out
 * of the cold-start bundle parse — waiters never open most of these in a shift.
 */
export function lazyScreen<P extends object>(
  loader: ScreenLoader<P>,
  fallbackMessage?: string,
): React.ComponentType<P> {
  const Lazy = React.lazy(loader);
  function LazyScreenWrapper(props: P) {
    return (
      <Suspense fallback={<LoadingScreen message={fallbackMessage} />}>
        <Lazy {...props} />
      </Suspense>
    );
  }
  LazyScreenWrapper.displayName = 'LazyScreen';
  return LazyScreenWrapper;
}
