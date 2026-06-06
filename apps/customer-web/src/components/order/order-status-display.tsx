'use client';

import { useTranslation } from '@gustri/i18n';
import { Badge } from '@gustri/ui-web';
import { getStatusColor } from '@/lib/utils';

/**
 * Shared status display primitives for the customer order-status screens
 * (dine-in `order-status.tsx` and delivery `delivery-order-status.tsx`).
 *
 * Both screens render an item-status badge and a set of order-status
 * banners. The two screens deliberately differ in label keys, colors, and
 * which statuses surface a banner, so each behavior lives behind a
 * `variant` and the per-variant lookup tables below — rendered output is
 * byte-for-byte identical to the pre-extraction inline code.
 */

type DisplayVariant = 'dineIn' | 'delivery';

// ---------------------------------------------------------------------------
// Item-status badge
// ---------------------------------------------------------------------------

// Dine-in: light bordered badge + dedicated label keys (cancelled falls back
// to the top-level `orderStatus.cancelled` key, matching the original).
const DINE_IN_ITEM_LABEL_KEYS: Record<string, string> = {
  pending: 'orderStatus.itemStatus.pending',
  preparing: 'orderStatus.itemStatus.preparing',
  ready: 'orderStatus.itemStatus.ready',
  served: 'orderStatus.itemStatus.served',
  cancelled: 'orderStatus.cancelled',
};

const DINE_IN_ITEM_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700 border-gray-300',
  preparing: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  ready: 'bg-green-50 text-green-700 border-green-300',
  served: 'bg-purple-50 text-purple-700 border-purple-300',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const DINE_IN_ITEM_FALLBACK_COLOR = 'bg-gray-100 text-gray-700 border-gray-300';

interface ItemStatusBadgeProps {
  status: string;
  variant: DisplayVariant;
}

/**
 * Item-status badge shared by both screens.
 * - `dineIn`: bordered light badge, dedicated label keys.
 * - `delivery`: solid `getStatusColor` badge, generic `itemStatus.*` key
 *   with the raw status as default value.
 */
export function ItemStatusBadge({ status, variant }: ItemStatusBadgeProps) {
  const { t } = useTranslation('customer');

  if (variant === 'delivery') {
    return (
      <Badge variant="outline" className={`mt-2 text-xs ${getStatusColor(status)}`}>
        {t(`orderStatus.itemStatus.${status}`, { defaultValue: status })}
      </Badge>
    );
  }

  const labelKey = DINE_IN_ITEM_LABEL_KEYS[status];
  const label = labelKey ? t(labelKey) : status;
  const colorClasses = DINE_IN_ITEM_COLORS[status] ?? DINE_IN_ITEM_FALLBACK_COLOR;

  return (
    <Badge variant="outline" className={`text-xs ${colorClasses}`}>
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Order-status banner
// ---------------------------------------------------------------------------

interface BannerSpec {
  /** Outer container classes (excludes the shared `mt-4 p-3 rounded-lg`). */
  containerClasses: string;
  /** Primary line. */
  labelKey: string;
  /** Optional emoji rendered before the label, e.g. `⏳`. */
  emoji?: string;
  /** Classes for the primary <p>. */
  textClasses: string;
  /** Optional second line (dine-in pending-approval sub-text). */
  subLabelKey?: string;
  /** Classes for the optional second <p>. */
  subTextClasses?: string;
}

// Dine-in banners — exact reproduction of the original inline divs.
const DINE_IN_BANNERS: Record<string, BannerSpec> = {
  pending_approval: {
    containerClasses: 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800',
    emoji: '⏳',
    labelKey: 'orderStatus.banner.pendingApproval',
    textClasses: 'text-sm text-center font-medium text-amber-800 dark:text-amber-200',
    subLabelKey: 'orderStatus.banner.pendingApprovalSub',
    subTextClasses: 'text-xs text-center text-amber-600 dark:text-amber-400 mt-1',
  },
  new: {
    containerClasses: 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800',
    emoji: '✓',
    labelKey: 'orderStatus.banner.confirmed',
    textClasses: 'text-sm text-center font-medium text-blue-800 dark:text-blue-200',
  },
  preparing: {
    containerClasses: 'bg-yellow-50 dark:bg-yellow-950',
    emoji: '🔥',
    labelKey: 'orderStatus.banner.preparing',
    textClasses: 'text-sm text-center',
  },
  ready: {
    containerClasses: 'bg-green-50 dark:bg-green-950',
    emoji: '✨',
    labelKey: 'orderStatus.banner.ready',
    textClasses: 'text-sm text-center font-medium',
  },
  served: {
    containerClasses:
      'bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800',
    labelKey: 'orderStatus.banner.served',
    textClasses: 'text-sm text-center font-medium text-purple-800 dark:text-purple-200',
  },
};

// Delivery banners — exact reproduction of the original inline divs.
const DELIVERY_BANNERS: Record<string, BannerSpec> = {
  pending_approval: {
    containerClasses: 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800',
    labelKey: 'deliveryStatus.banner.pendingApproval',
    textClasses: 'text-sm text-center font-medium text-amber-800 dark:text-amber-200',
  },
  out_for_delivery: {
    containerClasses:
      'bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800',
    labelKey: 'deliveryStatus.banner.outForDelivery',
    textClasses: 'text-sm text-center font-medium text-purple-800 dark:text-purple-200',
  },
  delivered: {
    containerClasses: 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800',
    labelKey: 'deliveryStatus.banner.delivered',
    textClasses: 'text-sm text-center font-medium text-green-800 dark:text-green-200',
  },
};

const BANNERS_BY_VARIANT: Record<DisplayVariant, Record<string, BannerSpec>> = {
  dineIn: DINE_IN_BANNERS,
  delivery: DELIVERY_BANNERS,
};

interface OrderStatusBannerProps {
  status: string;
  variant: DisplayVariant;
}

/**
 * Order-status banner shared by both screens. Renders nothing when the
 * current status has no banner for the given variant — preserving each
 * screen's "which statuses show a banner" behavior exactly.
 */
export function OrderStatusBanner({ status, variant }: OrderStatusBannerProps) {
  const { t } = useTranslation('customer');
  const spec = BANNERS_BY_VARIANT[variant][status];
  if (!spec) return null;

  return (
    <div className={`mt-4 p-3 rounded-lg ${spec.containerClasses}`}>
      <p className={spec.textClasses}>
        {spec.emoji ? `${spec.emoji} ` : ''}
        {t(spec.labelKey)}
      </p>
      {spec.subLabelKey && <p className={spec.subTextClasses}>{t(spec.subLabelKey)}</p>}
    </div>
  );
}
