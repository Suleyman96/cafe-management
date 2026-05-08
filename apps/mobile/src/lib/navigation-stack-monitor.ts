import type { NavigationState, PartialState } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';

/**
 * Soft cap on the depth of any single stack in the navigation tree.
 *
 * Every screen-to-screen transition in this app uses `navigation.navigate()`,
 * which deduplicates by screen name on a Stack Navigator — repeated
 * `List → Detail → goBack → Detail` cycles are push+pop and stay at depth 2.
 * The natural-reachable depth in the app is ~3 (e.g. `OrdersList →
 * OrderDetail → AddItems`).
 *
 * If a stack ever climbs past 15 in production, that's almost certainly a
 * regression — somebody introduced a `navigation.push()` (which does NOT
 * dedupe) or a deep-link path that bypasses the goBack contract. The cap
 * itself doesn't prevent the bug; it surfaces a Sentry signal so we know
 * to investigate before staff hit broken back-button UX or memory pressure
 * after an 8-hour shift.
 */
const STACK_DEPTH_SOFT_CAP = 15;

let hasReportedDepthExceeded = false;

/**
 * Reset the once-per-session report flag — call from logout so a fresh
 * session can re-report independently if a regression also affects the
 * next user. Without this, the first session's report silences every
 * subsequent session for the same app launch.
 */
export function resetNavigationStackMonitor(): void {
  hasReportedDepthExceeded = false;
}

type AnyNavState = NavigationState | PartialState<NavigationState> | undefined;

/**
 * Walk the navigation tree depth-first and return the deepest stack found.
 * `routes.length` is the depth of THIS navigator; nested children may be
 * deeper. We follow `state` on each route to descend into nested
 * navigators (Drawer → Tab → Stack → Stack).
 */
export function maxStackDepth(state: AnyNavState): number {
  if (!state?.routes) return 0;
  let max = state.routes.length;
  for (const route of state.routes) {
    const child = (route as { state?: AnyNavState }).state;
    if (child) {
      const childDepth = maxStackDepth(child);
      if (childDepth > max) max = childDepth;
    }
  }
  return max;
}

/**
 * Inspect the latest navigation state and emit a single Sentry message if
 * any stack in the tree has crossed the soft cap. Idempotent within a
 * session — only the first crossing is reported.
 */
export function reportIfStackDepthExceeded(state: AnyNavState): void {
  if (hasReportedDepthExceeded) return;
  const depth = maxStackDepth(state);
  if (depth <= STACK_DEPTH_SOFT_CAP) return;

  hasReportedDepthExceeded = true;
  Sentry.captureMessage(`navigation stack depth exceeded soft cap (${depth})`, {
    level: 'warning',
    tags: { area: 'navigation-stack' },
    extra: { depth, cap: STACK_DEPTH_SOFT_CAP },
  });
}

// Test hook — vitest-only escape hatch.
export const __navigationMonitorInternals = {
  STACK_DEPTH_SOFT_CAP,
  getHasReported: () => hasReportedDepthExceeded,
};
