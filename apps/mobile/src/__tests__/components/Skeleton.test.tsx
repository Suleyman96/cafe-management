import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    const out: Record<string, unknown> = {};
    for (const s of style) Object.assign(out, flattenStyle(s));
    return out;
  }
  return (style as Record<string, unknown>) ?? {};
}

// The Animated.View loop is exercised in `useEffect`; the test cares about
// the rendered geometry (width / height / radius), not the pulse cadence.
vi.mock('react-native', () => {
  class AnimatedValue {
    setValue() {}
  }
  const noopAnimation = { start: () => {}, stop: () => {} };
  const View = ({ children, style, ...props }: any) => (
    <div data-testid="skeleton" style={flattenStyle(style)} {...props}>
      {children}
    </div>
  );
  return {
    StyleSheet: { create: <T extends Record<string, unknown>>(s: T) => s },
    Animated: {
      View,
      Value: AnimatedValue,
      timing: () => noopAnimation,
      sequence: () => noopAnimation,
      loop: () => noopAnimation,
    },
  };
});

import { Skeleton } from '@gustri/ui-mobile';

describe('Skeleton (mobile)', () => {
  afterEach(() => cleanup());

  it('renders with default geometry', () => {
    const { getByTestId } = render(<Skeleton />);
    const node = getByTestId('skeleton');
    expect(node.style.width).toBe('100%');
    expect(node.style.height).toBe('16px');
    expect(node.style.borderRadius).toBe('6px');
  });

  it('respects width / height / radius props', () => {
    const { getByTestId } = render(<Skeleton width={120} height={24} radius={12} />);
    const node = getByTestId('skeleton');
    expect(node.style.width).toBe('120px');
    expect(node.style.height).toBe('24px');
    expect(node.style.borderRadius).toBe('12px');
  });

  it('merges caller-provided style overrides last', () => {
    const { getByTestId } = render(<Skeleton style={{ backgroundColor: '#000000' }} />);
    const node = getByTestId('skeleton');
    expect(node.style.backgroundColor).toBe('rgb(0, 0, 0)');
  });
});
