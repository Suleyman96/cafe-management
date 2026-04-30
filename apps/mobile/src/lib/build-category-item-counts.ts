/**
 * Build a `categoryId → count` map in one pass over `items`. Used by
 * MenuManagementScreen's chip loop — pre-M11 the count was a nested
 * `.filter()` per chip per render, O(items × categories).
 */
export function buildCategoryItemCounts(
  items: ReadonlyArray<{ category_id: string | null }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.category_id) continue;
    map.set(item.category_id, (map.get(item.category_id) ?? 0) + 1);
  }
  return map;
}
