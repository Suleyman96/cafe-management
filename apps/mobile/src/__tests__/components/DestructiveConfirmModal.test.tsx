import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// React-Native primitives → plain DOM. The test exercises gesture +
// timer logic, not native rendering.
// Flatten React-Native style arrays so the inline `width` value is
// observable from the DOM. RN accepts `style={[a, b]}`; the DOM does not.
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
  Pressable: ({ children, onPressIn, onPressOut, testID, ...props }: any) => (
    <button
      type="button"
      data-testid={testID}
      onMouseDown={onPressIn}
      onMouseUp={onPressOut}
      onMouseLeave={onPressOut}
      {...props}
    >
      {children}
    </button>
  ),
  StyleSheet: { create: <T extends Record<string, unknown>>(s: T) => s },
}));

// Paper Dialog/Portal/Button/Text → minimal stand-ins. Portal is a
// no-op pass-through; Dialog gates on `visible`; Buttons render as
// simple buttons that call onPress.
vi.mock('react-native-paper', () => ({
  Portal: ({ children }: any) => <>{children}</>,
  Dialog: Object.assign(
    ({ visible, children }: any) => (visible ? <div data-testid="dialog">{children}</div> : null),
    {
      Title: ({ children }: any) => <h3>{children}</h3>,
      Content: ({ children }: any) => <div>{children}</div>,
      Actions: ({ children }: any) => <div>{children}</div>,
    },
  ),
  Button: ({ children, onPress }: any) => (
    <button type="button" onClick={onPress} data-testid="cancel-button">
      {children}
    </button>
  ),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  // `TextInput` (and its sub-components) is destructured by `paper-compat`
  // — re-exported from the `@gustri/ui-mobile` barrel. Provide passthrough
  // stubs so the barrel evaluation doesn't blow up. Tests don't use it.
  TextInput: Object.assign(({ children }: any) => <span>{children}</span>, {
    Icon: ({ children }: any) => <span>{children}</span>,
    Affix: ({ children }: any) => <span>{children}</span>,
  }),
}));

import { DestructiveConfirmModal } from '@gustri/ui-mobile';

describe('DestructiveConfirmModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  function makeProps(
    overrides: Partial<React.ComponentProps<typeof DestructiveConfirmModal>> = {},
  ) {
    return {
      visible: true,
      title: 'Delete task',
      message: 'Are you sure?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      holdDurationMs: 1000,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
      ...overrides,
    };
  }

  it('renders nothing when visible=false', () => {
    const props = makeProps({ visible: false });
    const { queryByTestId } = render(<DestructiveConfirmModal {...props} />);
    expect(queryByTestId('dialog')).toBeNull();
  });

  it('renders title, message, and both buttons when visible', () => {
    const { getByText, getByTestId } = render(<DestructiveConfirmModal {...makeProps()} />);
    expect(getByText('Delete task')).toBeTruthy();
    expect(getByText('Are you sure?')).toBeTruthy();
    expect(getByTestId('destructive-confirm-button')).toBeTruthy();
    expect(getByTestId('cancel-button')).toBeTruthy();
  });

  it('calls onCancel when cancel button is pressed', () => {
    const onCancel = vi.fn();
    const { getByTestId } = render(<DestructiveConfirmModal {...makeProps({ onCancel })} />);
    fireEvent.click(getByTestId('cancel-button'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does NOT call onConfirm on a quick tap (release before holdDurationMs)', () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(<DestructiveConfirmModal {...makeProps({ onConfirm })} />);
    const btn = getByTestId('destructive-confirm-button');
    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.mouseUp(btn);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm exactly once when held for the full holdDurationMs', () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(<DestructiveConfirmModal {...makeProps({ onConfirm })} />);
    const btn = getByTestId('destructive-confirm-button');
    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('resets the hold timer if the user releases and re-presses (no leak through release)', () => {
    const onConfirm = vi.fn();
    const { getByTestId } = render(<DestructiveConfirmModal {...makeProps({ onConfirm })} />);
    const btn = getByTestId('destructive-confirm-button');

    // First press: 800 ms then release. No fire.
    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.mouseUp(btn);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    // Second press: full duration. Fires once (counter resumes from 0,
    // not from the 800ms residue of the first press).
    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not fire onConfirm if visible flips false mid-hold', () => {
    const onConfirm = vi.fn();
    const { getByTestId, rerender } = render(
      <DestructiveConfirmModal {...makeProps({ onConfirm })} />,
    );
    const btn = getByTestId('destructive-confirm-button');
    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(<DestructiveConfirmModal {...makeProps({ onConfirm, visible: false })} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('reflects hold progress on the progress fill width', () => {
    const { getByTestId } = render(
      <DestructiveConfirmModal {...makeProps({ holdDurationMs: 1000 })} />,
    );
    const btn = getByTestId('destructive-confirm-button');
    const fill = getByTestId('destructive-confirm-progress');
    expect(fill.getAttribute('style') || '').toContain('width: 0%');

    fireEvent.mouseDown(btn);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // The interval ticks every 30 ms; after 500 ms the progress is ≥ 30%
    // and ≤ 70% (allow slack for tick alignment).
    const styleAfter = fill.getAttribute('style') || '';
    const match = styleAfter.match(/width:\s*(\d+)%/);
    expect(match).not.toBeNull();
    const width = match ? Number(match[1]) : 0;
    expect(width).toBeGreaterThanOrEqual(30);
    expect(width).toBeLessThanOrEqual(70);
  });
});
