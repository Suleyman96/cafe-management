import type { MenuItem, Order } from '@gustri/database/types';

/**
 * Channel-policy filter applied to "add items" pickers (mobile
 * AddItemsScreen, staff-web add-items page).
 *
 * `takeout` orders only allow `is_takeoutable` items; `delivery` only
 * allows `is_deliverable`. All other order types (dine_in) impose no
 * channel filter — only the transient `is_available` gate applies.
 *
 * Returning a discriminator string instead of the boolean predicate
 * directly keeps the screen render-side memo cheap: the filter value is
 * stable until the order's `order_type` changes, which it never does
 * after creation. Also makes the value snapshottable for telemetry /
 * Sentry breadcrumbs without serialising a function.
 *
 * Lives in @gustri/core so the same logic backs both the web and mobile
 * pickers — the surfaces look different but the channel policy is one
 * decision per order_type and must not diverge across platforms.
 */
export type ChannelFilter = 'takeoutable' | 'deliverable' | null;

export function deriveChannelFilter(
  orderType: Order['order_type'] | null | undefined,
): ChannelFilter {
  if (orderType === 'takeout') return 'takeoutable';
  if (orderType === 'delivery') return 'deliverable';
  return null;
}

interface ApplyMenuFilterArgs {
  items: MenuItem[];
  selectedCategoryId: string | null;
  channelFilter: ChannelFilter;
}

/**
 * Combines category restriction + channel restriction in one pass.
 * Order of guards is intentional: cheap equality checks first, channel
 * boolean reads second — the channel check short-circuits the loop for
 * non-matching items as quickly as possible.
 */
export function applyMenuFilter({
  items,
  selectedCategoryId,
  channelFilter,
}: ApplyMenuFilterArgs): MenuItem[] {
  return items.filter((item) => {
    if (selectedCategoryId && item.category_id !== selectedCategoryId) return false;
    if (channelFilter === 'takeoutable' && !item.is_takeoutable) return false;
    if (channelFilter === 'deliverable' && !item.is_deliverable) return false;
    return true;
  });
}
