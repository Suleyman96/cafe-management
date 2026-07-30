/**
 * Guards the type-to-confirm gate on the account-closure danger zone: the
 * destructive button must stay disabled until the user types the exact phrase,
 * and confirming forwards the (trimmed) reason to the deactivate mutation.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Local i18n mock (returns the key) so buttons have predictable accessible names.
vi.mock('@gustri/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mutateAsync = vi.fn().mockResolvedValue({ status: 'deactivated' });
vi.mock('@/hooks/use-deactivate-tenant', () => ({
  useDeactivateTenant: () => ({ mutateAsync, isPending: false }),
}));

import { CloseAccountSection } from '@/components/settings/close-account-section';

beforeEach(() => {
  mutateAsync.mockClear();
});

function openModal() {
  fireEvent.click(
    screen.getByRole('button', { name: 'cafeSettings.dangerZone.closeAccountButton' }),
  );
}

describe('CloseAccountSection', () => {
  it('keeps the confirm button disabled until CLOSE is typed exactly', () => {
    render(<CloseAccountSection />);
    openModal();

    const confirm = screen.getByRole('button', { name: 'cafeSettings.dangerZone.confirmButton' });
    expect(confirm).toBeDisabled();

    const phraseInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(phraseInput, { target: { value: 'close' } }); // wrong case
    expect(confirm).toBeDisabled();

    fireEvent.change(phraseInput, { target: { value: 'CLOSE' } });
    expect(confirm).toBeEnabled();
  });

  it('forwards the trimmed reason to the deactivate mutation on confirm', () => {
    render(<CloseAccountSection />);
    openModal();

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '  moving out  ' } });
    const phraseInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(phraseInput, { target: { value: 'CLOSE' } });

    fireEvent.click(screen.getByRole('button', { name: 'cafeSettings.dangerZone.confirmButton' }));
    expect(mutateAsync).toHaveBeenCalledWith('moving out');
  });

  it('does not render the modal until the trigger is clicked', () => {
    render(<CloseAccountSection />);
    expect(
      screen.queryByRole('button', { name: 'cafeSettings.dangerZone.confirmButton' }),
    ).toBeNull();
  });
});
