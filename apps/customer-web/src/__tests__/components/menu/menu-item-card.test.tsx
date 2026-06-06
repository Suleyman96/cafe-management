/**
 * MenuItemCard — keyboard / screen-reader access to the detail modal (audit #8).
 *
 * The detail modal is where allergen + modifier info lives. Before the fix the
 * only way to open it was clicking the card `<div onClick>`, which keyboard and
 * screen-reader users can't reach. The item name is now a real `<button>` with
 * `aria-haspopup="dialog"`, so the modal is reachable without a pointer.
 *
 * The heavy `MenuItemModal` is stubbed — we only assert the card opens it.
 */

import { MenuItemCard } from '@/components/menu/menu-item-card';
import { fireEvent, renderWithProviders, screen } from '../../helpers/test-utils';

vi.mock('@/components/menu/menu-item-modal', () => ({
  MenuItemModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">detail-modal</div> : null,
}));

const item = {
  id: '1',
  name: 'Veggie Burger',
  name_en: 'Veggie Burger',
  price: 10,
  image_url: null,
  category: { icon: '🍔' },
  is_available: true,
} as never;

describe('MenuItemCard — detail-modal a11y (audit #8)', () => {
  it('exposes the item name as a button that announces a dialog popup', () => {
    renderWithProviders(<MenuItemCard item={item} accentColor="#367B8B" />);

    // The name is a real <button> (not a static div), so keyboard + SR users
    // can reach it — the core of audit #8. The accessible name routes through
    // the new `viewDetailsA11y` label.
    const trigger = screen.getByRole('button', { name: /viewDetailsA11y/ });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens the detail modal when the name button is activated', () => {
    renderWithProviders(<MenuItemCard item={item} accentColor="#367B8B" />);

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /viewDetailsA11y/ }));
    // A native <button> is operated by Enter/Space too — click is the
    // canonical activation event the browser dispatches for both.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
