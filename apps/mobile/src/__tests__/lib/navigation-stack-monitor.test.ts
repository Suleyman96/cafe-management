import * as Sentry from '@sentry/react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The default mock-sentry helper exports plain `noop` functions; override
// here with `vi.fn()` so we can assert call counts.
vi.mock('@sentry/react-native', () => ({
  captureMessage: vi.fn(),
}));

import {
  __navigationMonitorInternals,
  maxStackDepth,
  reportIfStackDepthExceeded,
  resetNavigationStackMonitor,
} from '@/lib/navigation-stack-monitor';

const { STACK_DEPTH_SOFT_CAP } = __navigationMonitorInternals;

beforeEach(() => {
  resetNavigationStackMonitor();
  vi.mocked(Sentry.captureMessage).mockClear();
});

afterEach(() => {
  resetNavigationStackMonitor();
});

function makeStack(routes: { name: string; state?: unknown }[]) {
  return {
    index: routes.length - 1,
    routes,
  };
}

describe('maxStackDepth', () => {
  it('returns 0 for missing state', () => {
    expect(maxStackDepth(undefined)).toBe(0);
  });

  it('counts the routes at the top level', () => {
    const state = makeStack([{ name: 'List' }, { name: 'Detail' }]);
    expect(maxStackDepth(state as never)).toBe(2);
  });

  it('finds the deepest nested stack, not the top one', () => {
    // Drawer → OrdersTab(Stack with 4 routes). Top-level has 1 route, but
    // the deepest reachable stack is 4 — that's what we care about.
    const state = makeStack([
      {
        name: 'OrdersTab',
        state: makeStack([
          { name: 'OrdersList' },
          { name: 'OrderDetail' },
          { name: 'AddItems' },
          { name: 'OrderPayment' },
        ]),
      },
    ]);
    expect(maxStackDepth(state as never)).toBe(4);
  });
});

describe('reportIfStackDepthExceeded', () => {
  it('does nothing when depth is at or below the soft cap', () => {
    const state = makeStack(
      Array.from({ length: STACK_DEPTH_SOFT_CAP }, (_, i) => ({ name: `R${i}` })),
    );
    reportIfStackDepthExceeded(state as never);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('emits one Sentry message when depth crosses the soft cap', () => {
    const state = makeStack(
      Array.from({ length: STACK_DEPTH_SOFT_CAP + 1 }, (_, i) => ({ name: `R${i}` })),
    );
    reportIfStackDepthExceeded(state as never);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('navigation stack depth exceeded'),
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('does not re-report after the first crossing within a session', () => {
    const state = makeStack(
      Array.from({ length: STACK_DEPTH_SOFT_CAP + 5 }, (_, i) => ({ name: `R${i}` })),
    );
    reportIfStackDepthExceeded(state as never);
    reportIfStackDepthExceeded(state as never);
    reportIfStackDepthExceeded(state as never);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('re-arms after resetNavigationStackMonitor', () => {
    const state = makeStack(
      Array.from({ length: STACK_DEPTH_SOFT_CAP + 1 }, (_, i) => ({ name: `R${i}` })),
    );
    reportIfStackDepthExceeded(state as never);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);

    resetNavigationStackMonitor();
    reportIfStackDepthExceeded(state as never);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(2);
  });
});
