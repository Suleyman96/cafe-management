import userEvent from '@testing-library/user-event';
import { CartItemCard } from '@/components/cart/cart-item-card';
import { renderWithProviders, screen } from '../helpers/test-utils';

// Feature: "Cart notes editing persists correctly"
// Tests that save persists, cancel reverts, and notes display is correct.

describe('Cart notes editing persists correctly', () => {
  const baseItem = {
    menuItem: { id: 'item-1', name: 'Latte', price: 5 },
    quantity: 2,
    notes: 'extra milk',
    lineKey: 'item-1',
  };

  const defaultProps = {
    item: baseItem,
    taxMultiplier: 1,
    allowItemNotes: true,
    editingNotes: null as string | null,
    tempNotes: {} as Record<string, string>,
    onEditNotes: vi.fn(),
    onCancelEditNotes: vi.fn(),
    onSaveNotes: vi.fn(),
    onTempNotesChange: vi.fn(),
    onRemoveItem: vi.fn(),
    onUpdateQuantity: vi.fn(),
    formatPrice: (amount: number) => `${amount.toFixed(2)}₼`,
    priceLabel: '5.00₼ each',
  };

  it('displays existing notes in view mode', () => {
    renderWithProviders(<CartItemCard {...defaultProps} />);
    expect(screen.getByText('extra milk')).toBeInTheDocument();
  });

  it('shows add-notes button when item has no notes', () => {
    renderWithProviders(
      <CartItemCard {...defaultProps} item={{ ...baseItem, notes: undefined }} />,
    );
    expect(screen.getByText('cart.addSpecialNotes')).toBeInTheDocument();
  });

  it('calls onSaveNotes with item id and new note text', async () => {
    const user = userEvent.setup();
    const onSaveNotes = vi.fn();

    renderWithProviders(
      <CartItemCard
        {...defaultProps}
        editingNotes="item-1"
        tempNotes={{ 'item-1': 'new note' }}
        onSaveNotes={onSaveNotes}
      />,
    );

    await user.click(screen.getByText('save:{"ns":"common"}'));
    expect(onSaveNotes).toHaveBeenCalledWith('item-1', 'new note');
  });

  it('calls onCancelEditNotes with item id when cancelling', async () => {
    const user = userEvent.setup();
    const onCancelEditNotes = vi.fn();

    renderWithProviders(
      <CartItemCard
        {...defaultProps}
        editingNotes="item-1"
        tempNotes={{ 'item-1': 'unsaved changes' }}
        onCancelEditNotes={onCancelEditNotes}
      />,
    );

    await user.click(screen.getByText('cancel:{"ns":"common"}'));
    expect(onCancelEditNotes).toHaveBeenCalledWith('item-1');
  });

  it('hides notes section entirely when allowItemNotes is false', () => {
    renderWithProviders(<CartItemCard {...defaultProps} allowItemNotes={false} />);
    expect(screen.queryByText('extra milk')).not.toBeInTheDocument();
    expect(screen.queryByText('cart.addSpecialNotes')).not.toBeInTheDocument();
  });
});
