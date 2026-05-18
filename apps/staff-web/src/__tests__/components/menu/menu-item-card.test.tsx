import type { Database } from '@gustri/database';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks', () => ({ useTaxMultiplier: () => 1 }));
vi.mock('@/hooks/use-format-price', () => ({
  useFormatPrice: () => (n: number) => `$${n.toFixed(2)}`,
}));

import { MenuItemCard } from '@/components/menu/menu-item-card';

type MenuItem = Database['public']['Tables']['menu_items']['Row'];

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'mi-1',
    name: 'Burger',
    description: null,
    price: 10,
    category_id: 'cat-1',
    image_url: null,
    preparation_time: null,
    is_popular: false,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    is_spicy: false,
    allergens: null,
    is_available: true,
    is_takeoutable: true,
    is_deliverable: true,
    is_daily_special: false,
    display_order: 0,
    tenant_id: 't1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as unknown as MenuItem;
}

// Simple translator stub: returns the i18n key verbatim. Tests assert on
// keys (e.g. menu.markUnavailable) so they don't have to keep up with
// English copy edits.
const t = (key: string) => key;

function renderCard(item: MenuItem) {
  return render(
    <MenuItemCard
      item={item}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onToggleAvailability={vi.fn()}
      onToggleTakeoutable={vi.fn()}
      onToggleDeliverable={vi.fn()}
      t={t}
    />,
  );
}

// Behavior under test:
//   The three channel toggles (Available / Takeout / Delivery) must be
//   announced to assistive tech as toggle buttons with current pressed
//   state — sighted users see a colored switch, but screen-reader users
//   would otherwise hear only the label and miss whether the toggle is
//   on or off. `aria-pressed={active}` + `aria-label` (with on/off
//   action prose from the existing `mark*` i18n keys) closes that gap.

describe('MenuItemCard — channel toggles a11y', () => {
  it('all three toggles render with aria-pressed reflecting the current state', () => {
    // Mixed state to verify pressed/not-pressed are wired per-toggle,
    // not all-or-nothing.
    renderCard(makeItem({ is_available: true, is_takeoutable: false, is_deliverable: true }));

    // aria-label takes the action-description string (markUnavailable
    // means it IS available; click would turn it off). Querying by
    // aria-label keeps the assertion stable across visual label changes.
    const availableBtn = screen.getByRole('button', { name: 'menu.markUnavailable' });
    const takeoutBtn = screen.getByRole('button', { name: 'menu.markTakeoutable' });
    const deliveryBtn = screen.getByRole('button', { name: 'menu.markNotDeliverable' });

    expect(availableBtn).toHaveAttribute('aria-pressed', 'true');
    expect(takeoutBtn).toHaveAttribute('aria-pressed', 'false');
    expect(deliveryBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('flips the aria-label between mark/unmark phrasing based on state', () => {
    // The action description must invert when the flag flips — "Mark as
    // available" is wrong if the item is already available. This catches
    // a regression where someone accidentally hardcodes one direction.
    renderCard(makeItem({ is_takeoutable: true }));
    expect(screen.getByRole('button', { name: 'menu.markNotTakeoutable' })).toBeInTheDocument();

    renderCard(makeItem({ id: 'b', is_takeoutable: false }));
    expect(screen.getByRole('button', { name: 'menu.markTakeoutable' })).toBeInTheDocument();
  });

  it('channel toggles set type="button" so clicks never accidentally submit a parent form', () => {
    // Defensive: in the menu admin grid the card sometimes sits inside
    // a search-box <form>. Without an explicit type, browsers default to
    // type="submit" and clicking a toggle would post the form. Scoped
    // to the channel toggles only — the edit/delete icon buttons are a
    // separate concern.
    renderCard(makeItem());
    expect(screen.getByRole('button', { name: 'menu.markUnavailable' })).toHaveAttribute(
      'type',
      'button',
    );
    expect(screen.getByRole('button', { name: 'menu.markNotTakeoutable' })).toHaveAttribute(
      'type',
      'button',
    );
    expect(screen.getByRole('button', { name: 'menu.markNotDeliverable' })).toHaveAttribute(
      'type',
      'button',
    );
  });
});
