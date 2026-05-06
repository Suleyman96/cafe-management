import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AudioToggleMenu } from '@/components/notifications/audio-toggle-menu';

/**
 * Plan 15 — per-event audio mute toggles. The menu is the only thing
 * preventing the staff member from accidentally muting all three channels
 * when they only meant to silence one. These tests pin down the contract:
 *   - Mixed prefs surface as the "partial" state on the trigger label.
 *   - Toggling an individual row only emits that channel's key, untouched.
 *   - Each row reports its checked state via aria-checked, so screen-reader
 *     users can navigate with the same fidelity as a sighted user.
 */
describe('AudioToggleMenu', () => {
  const allOn = { orders: true, waiterCalls: true, alerts: true };
  const allOff = { orders: false, waiterCalls: false, alerts: false };
  const mixed = { orders: true, waiterCalls: false, alerts: true };

  function getTriggerButton(container: HTMLElement): HTMLButtonElement {
    // The first <button> is always the trigger — the channel rows are
    // rendered inside the popover, which only mounts when the trigger is
    // clicked.
    const trigger = container.querySelector('button');
    if (!trigger) throw new Error('trigger button not found');
    return trigger as HTMLButtonElement;
  }

  it('shows soundOn label when every channel is enabled', () => {
    const { container } = render(<AudioToggleMenu prefs={allOn} onToggle={() => {}} />);
    expect(getTriggerButton(container).textContent).toContain('notifications.soundOn');
  });

  it('shows soundOff label when every channel is muted', () => {
    const { container } = render(<AudioToggleMenu prefs={allOff} onToggle={() => {}} />);
    expect(getTriggerButton(container).textContent).toContain('notifications.soundOff');
  });

  it('shows the partial label when channels are mixed', () => {
    const { container } = render(<AudioToggleMenu prefs={mixed} onToggle={() => {}} />);
    expect(getTriggerButton(container).textContent).toContain('notifications.audioPartial');
  });

  it('opens the menu and emits the channel key on row click', () => {
    const onToggle = vi.fn();
    const { container, getAllByRole } = render(
      <AudioToggleMenu prefs={allOn} onToggle={onToggle} />,
    );

    fireEvent.click(getTriggerButton(container));
    const rows = getAllByRole('menuitemcheckbox');
    expect(rows).toHaveLength(3);

    fireEvent.click(rows[1]); // waiterCalls is the second row
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('waiterCalls');
  });

  it('reflects each channel state via aria-checked', () => {
    const { container, getAllByRole } = render(
      <AudioToggleMenu prefs={mixed} onToggle={() => {}} />,
    );
    fireEvent.click(getTriggerButton(container));

    const rows = getAllByRole('menuitemcheckbox');
    expect(rows[0].getAttribute('aria-checked')).toBe('true'); // orders
    expect(rows[1].getAttribute('aria-checked')).toBe('false'); // waiterCalls
    expect(rows[2].getAttribute('aria-checked')).toBe('true'); // alerts
  });
});
