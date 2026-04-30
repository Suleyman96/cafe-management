import { describe, expect, it } from 'vitest';
import { buildCategoryItemCounts } from '@/lib/build-category-item-counts';

describe('buildCategoryItemCounts', () => {
  it('returns the count for each category in a single pass', () => {
    const items = [
      { category_id: 'A' },
      { category_id: 'A' },
      { category_id: 'B' },
      { category_id: 'A' },
      { category_id: 'B' },
    ];
    const map = buildCategoryItemCounts(items);
    expect(map.get('A')).toBe(3);
    expect(map.get('B')).toBe(2);
    expect(map.size).toBe(2);
  });

  it('skips items without a category', () => {
    const items = [{ category_id: null }, { category_id: 'A' }];
    expect(buildCategoryItemCounts(items).get('A')).toBe(1);
  });

  it('returns an empty map for an empty list', () => {
    expect(buildCategoryItemCounts([]).size).toBe(0);
  });
});
