import type { Category, MenuItem } from '@gustri/database';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../helpers/test-utils';

// Behavior under test:
//   1. Caller pre-filters by channel (is_takeoutable / is_deliverable) —
//      the picker shows every item it's given. is_available=false items
//      are kept visible but disabled (transient stock state).
//   2. Category tabs filter the list, AND combine with the search box.
//   3. Categories with zero matching items are hidden from the tab strip
//      (no dead tabs).
//   4. Image fallback: items with no image_url render the emoji placeholder.
//   5. Click on an enabled row invokes onAddItem with the item; click on a
//      disabled (out-of-stock) row does not.
//   6. The `accent` prop drives focus / hover styling — verified via the
//      class name on the active tab so the picker stays visually distinct
//      between takeout (orange) and delivery (purple) flows.

vi.mock('@/hooks/use-format-price', () => ({
  useFormatPrice: () => (n: number) => `$${n.toFixed(2)}`,
}));

import { MenuItemPickerWithCategories } from '@/components/orders/menu-item-picker-with-categories';

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'mi-1',
    name: 'Burger',
    description: null,
    price: 10,
    category_id: 'cat-1',
    image_url: null,
    is_available: true,
    is_takeoutable: true,
    is_deliverable: true,
    tenant_id: 't1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as unknown as MenuItem;
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Mains',
    description: null,
    icon: '🍔',
    display_order: 0,
    is_active: true,
    tenant_id: 't1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as unknown as Category;
}

describe('MenuItemPickerWithCategories', () => {
  it('renders every item it is given (caller owns channel filtering)', () => {
    const items = [
      makeItem({ id: 'a', name: 'Alpha' }),
      makeItem({ id: 'b', name: 'Bravo' }),
      makeItem({ id: 'c', name: 'Charlie' }),
    ];
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={items}
        categories={[]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('search box filters items by name (case-insensitive)', () => {
    const items = [
      makeItem({ id: 'a', name: 'Margherita Pizza' }),
      makeItem({ id: 'b', name: 'Caesar Salad' }),
    ];
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={items}
        categories={[]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: 'PIZZ' } });

    expect(screen.getByText('Margherita Pizza')).toBeInTheDocument();
    expect(screen.queryByText('Caesar Salad')).not.toBeInTheDocument();
  });

  it('selecting a category tab restricts the list to that category', () => {
    const mains = makeCategory({ id: 'cat-1', name: 'Mains', icon: '🍔' });
    const drinks = makeCategory({ id: 'cat-2', name: 'Drinks', icon: '🥤' });
    const items = [
      makeItem({ id: 'm1', name: 'Burger', category_id: 'cat-1' }),
      makeItem({ id: 'd1', name: 'Cola', category_id: 'cat-2' }),
    ];
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={items}
        categories={[mains, drinks]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    // Initial state: "All" selected, both items visible.
    expect(screen.getByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();

    // Click the Drinks sidebar tab.
    fireEvent.click(screen.getByRole('button', { name: /Drinks/ }));

    expect(screen.queryByText('Burger')).not.toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();
  });

  it('search and category filter combine (AND)', () => {
    const mains = makeCategory({ id: 'cat-1', name: 'Mains' });
    const items = [
      makeItem({ id: 'm1', name: 'Burger', category_id: 'cat-1' }),
      makeItem({ id: 'm2', name: 'Bacon Sandwich', category_id: 'cat-1' }),
      makeItem({ id: 'd1', name: 'Bacon Cola', category_id: 'cat-2' }),
    ];
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={items}
        categories={[mains]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mains/ }));
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'bacon' } });

    expect(screen.getByText('Bacon Sandwich')).toBeInTheDocument();
    // Excluded by category, even though it matches the search query.
    expect(screen.queryByText('Bacon Cola')).not.toBeInTheDocument();
    // Excluded by search, even though it matches the category.
    expect(screen.queryByText('Burger')).not.toBeInTheDocument();
  });

  it('hides categories that have no items in the given list', () => {
    // Empty category would render a tab with "(0)" — useless and noisy.
    const mains = makeCategory({ id: 'cat-1', name: 'Mains' });
    const drinks = makeCategory({ id: 'cat-2', name: 'Drinks' });
    const items = [makeItem({ id: 'm1', category_id: 'cat-1' })];
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={items}
        categories={[mains, drinks]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Mains/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Drinks/ })).not.toBeInTheDocument();
  });

  it('does not render the tab strip at all when no categories have items', () => {
    // If everything is uncategorised, the sidebar should not render.
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={[makeItem({ category_id: null })]}
        categories={[makeCategory()]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /allItems/ })).not.toBeInTheDocument();
  });

  it('clicking an available item invokes onAddItem with the full item', () => {
    const onAddItem = vi.fn();
    const item = makeItem({ id: 'add-me', name: 'Click Me' });
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={[item]}
        categories={[]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={onAddItem}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Click Me/ }));
    expect(onAddItem).toHaveBeenCalledTimes(1);
    expect(onAddItem).toHaveBeenCalledWith(item);
  });

  it('out-of-stock items render but are disabled (no onAddItem fired on click)', () => {
    const onAddItem = vi.fn();
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={[makeItem({ id: 'oos', name: 'Out Of Stock', is_available: false })]}
        categories={[]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={onAddItem}
      />,
    );

    const button = screen.getByRole('button', { name: /Out Of Stock/ });
    // Browser fires no click event on a disabled button; assert the
    // disabled attribute too in case of styling regressions that re-enable
    // it visually.
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onAddItem).not.toHaveBeenCalled();
  });

  it('renders the emoji fallback when an item has no image_url', () => {
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={[makeItem({ id: 'no-img', name: 'No Image', image_url: null })]}
        categories={[]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    const row = screen.getByRole('button', { name: /No Image/ });
    // The thumbnail container always renders; on the no-image path the
    // emoji is the only visual cue. Asserting on the literal 🍽️ couples
    // the test to the emoji choice but is the cheapest way to verify the
    // fallback path runs.
    expect(within(row).getByText('🍽️')).toBeInTheDocument();
  });

  it('renders <img> when an item has an image_url and skips the emoji fallback', () => {
    const { container } = renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={[makeItem({ id: 'has-img', name: 'Pic', image_url: 'https://example/img.png' })]}
        categories={[]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    const row = screen.getByRole('button', { name: /Pic/ });
    // `<img alt="">` has ARIA role "presentation" (decorative), so
    // getByRole('img') would miss it. Query the DOM directly — that's
    // the contract the picker actually has with its thumbnails.
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute('src', 'https://example/img.png');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(within(row).queryByText('🍽️')).not.toBeInTheDocument();
  });

  it('applies the accent colour to the active sidebar tab (orange vs purple)', () => {
    // The active sidebar tab uses a left-border indicator + subtle
    // accent background — `bg-{accent}-50` + `border-{accent}-500`.
    // Asserting on the border colour catches the contract that
    // distinguishes takeout (orange) from delivery (purple) visually.
    const cat = makeCategory({ id: 'cat-1', name: 'Mains' });
    const items = [makeItem({ id: 'a', category_id: 'cat-1' })];
    const { rerender } = renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={items}
        categories={[cat]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    const orangeTab = screen.getByRole('button', { name: /allItems/ });
    expect(orangeTab.className).toContain('border-orange-500');
    expect(orangeTab.className).toContain('bg-orange-50');

    rerender(
      <MenuItemPickerWithCategories
        menuItems={items}
        categories={[cat]}
        taxMultiplier={1}
        accent="purple"
        onAddItem={vi.fn()}
      />,
    );
    const purpleTab = screen.getByRole('button', { name: /allItems/ });
    expect(purpleTab.className).toContain('border-purple-500');
    expect(purpleTab.className).toContain('bg-purple-50');
    expect(purpleTab.className).not.toContain('border-orange-500');
  });

  it('renders name AND price in the same row (stacked layout regression guard)', () => {
    // The picker stacks name + price vertically inside each row so the
    // items column doesn't need to fit them side-by-side at narrow
    // widths. A regression where price stopped rendering (or vice
    // versa) would silently break the mobile layout's value-proposition.
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={[makeItem({ id: 'r1', name: 'Stacked Item', price: 42 })]}
        categories={[]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    const row = screen.getByRole('button', { name: /Stacked Item/ });
    // Both children must be present inside the same row; querying via
    // `within(row)` confirms they're co-located (not e.g. price moved
    // to a tooltip / hidden tag / row footer).
    expect(within(row).getByText('Stacked Item')).toBeInTheDocument();
    expect(within(row).getByText('$42.00')).toBeInTheDocument();
  });

  it('sidebar tabs expose aria-pressed reflecting the current selection (a11y)', () => {
    // Screen-reader users can't see the left-border accent that marks
    // the active sidebar tab. aria-pressed bridges that gap — assistive
    // tech announces "toggle button, pressed" for the active filter.
    const mains = makeCategory({ id: 'cat-1', name: 'Mains' });
    const drinks = makeCategory({ id: 'cat-2', name: 'Drinks' });
    const items = [
      makeItem({ id: 'm1', category_id: 'cat-1' }),
      makeItem({ id: 'd1', category_id: 'cat-2' }),
    ];
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={items}
        categories={[mains, drinks]}
        taxMultiplier={1}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    // Initial state: "All" is the active filter.
    expect(screen.getByRole('button', { name: /allItems/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Mains/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Drinks/ })).toHaveAttribute('aria-pressed', 'false');

    // After clicking Mains, only Mains is pressed.
    fireEvent.click(screen.getByRole('button', { name: /Mains/ }));
    expect(screen.getByRole('button', { name: /allItems/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /Mains/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Drinks/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('multiplies price by taxMultiplier in the displayed amount', () => {
    renderWithProviders(
      <MenuItemPickerWithCategories
        menuItems={[makeItem({ id: 'p', name: 'Pricey', price: 100 })]}
        categories={[]}
        taxMultiplier={1.18}
        accent="orange"
        onAddItem={vi.fn()}
      />,
    );

    // Mock formatPrice is `$${n.toFixed(2)}` — so 100 * 1.18 → "$118.00".
    expect(screen.getByText('$118.00')).toBeInTheDocument();
  });
});
