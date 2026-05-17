import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// React-Native primitives → plain DOM. Same shape as DestructiveConfirmModal.test.tsx.
function flattenStyle(style: any): Record<string, any> {
  if (Array.isArray(style)) {
    const out: Record<string, any> = {};
    for (const s of style) Object.assign(out, flattenStyle(s));
    return out;
  }
  return style ?? {};
}

vi.mock('react-native', () => ({
  View: ({ children, style, testID, ...props }: any) => (
    <div data-testid={testID} style={flattenStyle(style)} {...props}>
      {children}
    </div>
  ),
  Pressable: ({ children, onPress, accessibilityLabel, ...props }: any) => (
    <button type="button" onClick={onPress} aria-label={accessibilityLabel} {...props}>
      {children}
    </button>
  ),
  StyleSheet: { create: <T extends Record<string, unknown>>(s: T) => s, hairlineWidth: 1 },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: ({ name }: { name: string }) => (
    <i data-testid={`icon-${name}`} aria-hidden />
  ),
}));

vi.mock('@/lib/paper-compat', () => ({
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('@/theme', () => ({
  COLORS: {
    card: '#ffffff',
    border: '#e2e8f0',
    textPrimary: '#1e293b',
  },
}));

// Translation mock: return key suffix so we can assert which key was used.
vi.mock('@gustri/i18n', () => ({
  useTranslation: (ns?: string) => ({
    t: (k: string) => `${ns ?? 'def'}:${k}`,
  }),
}));

import { ScreenHeader } from '@/components/ui/ScreenHeader';

function makeProps(overrides: any = {}) {
  return {
    navigation: { goBack: vi.fn(), ...overrides.navigation },
    route: { key: 'r1', name: 'X', params: undefined },
    options: overrides.options ?? {},
    back: overrides.back,
    layout: { width: 360, height: 640 },
    styleInterpolator: undefined,
    progress: undefined,
    previous: undefined,
  } as any;
}

afterEach(cleanup);

describe('ScreenHeader', () => {
  it('resolves titleKey via the configured namespace', () => {
    const props = makeProps({ options: { titleKey: 'orders', titleNs: 'nav' } });
    const { getByText } = render(<ScreenHeader {...props} />);
    expect(getByText('nav:orders')).toBeTruthy();
  });

  it('defaults titleNs to "nav" when titleKey is set without titleNs', () => {
    const props = makeProps({ options: { titleKey: 'tables' } });
    const { getByText } = render(<ScreenHeader {...props} />);
    expect(getByText('nav:tables')).toBeTruthy();
  });

  it('honors the plain `title` field as a fallback when titleKey is absent', () => {
    const props = makeProps({ options: { title: 'Literal Title' } });
    const { getByText } = render(<ScreenHeader {...props} />);
    expect(getByText('Literal Title')).toBeTruthy();
  });

  it('renders the back button and wires it to navigation.goBack when `back` is present', () => {
    const goBack = vi.fn();
    const props = makeProps({
      navigation: { goBack },
      back: { title: 'Prev' },
      options: { titleKey: 'orderDetail' },
    });
    const { getByLabelText, getByTestId } = render(<ScreenHeader {...props} />);
    expect(getByTestId('icon-arrow-left')).toBeTruthy();
    fireEvent.click(getByLabelText('common:back'));
    expect(goBack).toHaveBeenCalledOnce();
  });

  it('renders headerLeft when supplied (replaces the default back arrow)', () => {
    const props = makeProps({
      back: { title: 'Prev' },
      options: {
        titleKey: 'orders',
        headerLeft: () => <span data-testid="drawer-btn">drawer</span>,
      },
    });
    const { getByTestId, queryByTestId } = render(<ScreenHeader {...props} />);
    expect(getByTestId('drawer-btn')).toBeTruthy();
    expect(queryByTestId('icon-arrow-left')).toBeNull();
  });

  it('renders headerRight when supplied', () => {
    const props = makeProps({
      options: {
        titleKey: 'kitchen',
        headerRight: () => <span data-testid="right-action">freshness</span>,
      },
    });
    const { getByTestId } = render(<ScreenHeader {...props} />);
    expect(getByTestId('right-action')).toBeTruthy();
  });

  it('renders nothing in the left slot when there is no back and no headerLeft', () => {
    const props = makeProps({ options: { titleKey: 'orders' } });
    const { queryByTestId } = render(<ScreenHeader {...props} />);
    expect(queryByTestId('icon-arrow-left')).toBeNull();
  });
});
