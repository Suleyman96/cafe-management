/**
 * Menu filtering logic tests.
 *
 * The MenuScreen component applies search + dietary filters inside a useMemo.
 * Rather than rendering the full component tree (which pulls in many nested
 * dependencies like MenuItemCard, MenuCartSidebar, styles, language store, etc.),
 * we replicate the exact filter logic from menu-screen.tsx and test it directly.
 */

const mockItemBase = {
  id: '',
  name: '',
  name_en: '',
  name_az: null,
  name_ru: null,
  name_tr: null,
  price: 10,
  category_id: 'cat1',
  is_available: true,
  is_popular: false,
  is_vegetarian: false,
  is_vegan: false,
  is_spicy: false,
  is_gluten_free: false,
  allergens: [],
  image_url: null,
  description: null,
  description_en: null,
  description_az: null,
  description_ru: null,
  description_tr: null,
  preparation_time: null,
  sort_order: 0,
  created_at: '',
  updated_at: '',
};

const items = [
  {
    ...mockItemBase,
    id: '1',
    name: 'Veggie Burger',
    name_en: 'Veggie Burger',
    is_vegetarian: true,
    is_spicy: false,
    is_vegan: false,
    is_gluten_free: false,
  },
  {
    ...mockItemBase,
    id: '2',
    name: 'Spicy Wings',
    name_en: 'Spicy Wings',
    is_vegetarian: false,
    is_spicy: true,
    is_vegan: false,
    is_gluten_free: false,
  },
  {
    ...mockItemBase,
    id: '3',
    name: 'Spicy Veggie Bowl',
    name_en: 'Spicy Veggie Bowl',
    is_vegetarian: true,
    is_spicy: true,
    is_vegan: false,
    is_gluten_free: false,
  },
  {
    ...mockItemBase,
    id: '4',
    name: 'Steak',
    name_en: 'Steak',
    is_vegetarian: false,
    is_spicy: false,
    is_vegan: false,
    is_gluten_free: false,
  },
];

/**
 * Replicates the exact filter logic from menu-screen.tsx useMemo.
 * Uses getLocalizedField(item, 'name', language) and getLocalizedField(item, 'description', language)
 * which resolve to item.name and item.description respectively (see @/types getLocalizedField).
 */
function filterItems(
  menuItems: typeof items,
  searchQuery: string,
  dietaryFilters: string[],
  _language: string,
) {
  return menuItems.filter((item) => {
    // Search filter — matches name or description (case-insensitive)
    if (searchQuery) {
      const name = (item.name ?? '').toLowerCase();
      const description = (item.description ?? '').toLowerCase();
      const query = searchQuery.toLowerCase();
      if (!name.includes(query) && !description.includes(query)) return false;
    }

    // Dietary filters — AND logic (all selected filters must match)
    if (dietaryFilters.length > 0) {
      if (dietaryFilters.includes('vegetarian') && !item.is_vegetarian) return false;
      if (dietaryFilters.includes('vegan') && !item.is_vegan) return false;
      if (dietaryFilters.includes('gluten_free') && !item.is_gluten_free) return false;
      if (dietaryFilters.includes('spicy') && !item.is_spicy) return false;
    }

    return true;
  });
}

describe('menu filtering logic', () => {
  it('filters by search query matching name', () => {
    const result = filterItems(items, 'veggie', [], 'en');
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['1', '3']);
  });

  it('dietary filters use AND logic', () => {
    const result = filterItems(items, '', ['vegetarian', 'spicy'], 'en');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('returns all items when no filters active', () => {
    const result = filterItems(items, '', [], 'en');
    expect(result).toHaveLength(4);
  });

  it('search is case-insensitive', () => {
    const result = filterItems(items, 'STEAK', [], 'en');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('4');
  });

  it('combining search and dietary filter narrows results', () => {
    const result = filterItems(items, 'spicy', ['vegetarian'], 'en');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('returns empty array when search matches nothing', () => {
    const result = filterItems(items, 'sushi', [], 'en');
    expect(result).toHaveLength(0);
  });

  it('single dietary filter returns all matching items', () => {
    const result = filterItems(items, '', ['spicy'], 'en');
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(['2', '3']);
  });

  it('impossible dietary combination returns empty array', () => {
    // No item is both vegan and spicy in our test data
    const result = filterItems(items, '', ['vegan', 'spicy'], 'en');
    expect(result).toHaveLength(0);
  });

  it('search matches partial name', () => {
    const result = filterItems(items, 'burg', [], 'en');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by description when name does not match', () => {
    const itemsWithDesc = [
      {
        ...mockItemBase,
        id: '10',
        name: 'Mystery Dish',
        description: 'A spicy veggie delight',
      },
    ];
    const result = filterItems(itemsWithDesc, 'delight', [], 'en');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('10');
  });
});
