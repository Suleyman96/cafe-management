/**
 * BaseModal — dialog a11y semantics (#7).
 *
 * Hardened to expose a proper dialog (role + aria-modal + aria-labelledby),
 * a labelled close button, and Escape-to-close. Focus-trap behavior relies on
 * a deferred `setTimeout` focus + a document keydown listener; here we assert
 * the static semantics + Escape, which is the contract consumers depend on.
 */

import { BaseModal } from '@/components/ui/base-modal';
import { fireEvent, renderWithProviders, screen } from '../../helpers/test-utils';

describe('BaseModal — a11y (#7)', () => {
  it('renders a labelled modal dialog', () => {
    renderWithProviders(
      <BaseModal isOpen onClose={() => {}} title="Edit menu item">
        <button type="button">Body control</button>
      </BaseModal>,
    );

    // role="dialog" + aria-modal, named by its title via aria-labelledby.
    const dialog = screen.getByRole('dialog', { name: 'Edit menu item' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('gives the icon-only close button an accessible name', () => {
    renderWithProviders(
      <BaseModal isOpen onClose={() => {}} title="T">
        <span>body</span>
      </BaseModal>,
    );
    // The staff-web i18n mock returns the key when untranslated → 'close'.
    expect(screen.getByRole('button', { name: 'close' })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <BaseModal isOpen onClose={onClose} title="T">
        <span>body</span>
      </BaseModal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    renderWithProviders(
      <BaseModal isOpen={false} onClose={() => {}} title="T">
        <span>body</span>
      </BaseModal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
