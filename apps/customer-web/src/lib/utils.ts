import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate elapsed time in minutes
 */
function getElapsedMinutes(timestamp: string): number {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  return Math.floor((now - then) / 1000 / 60);
}

/**
 * Format time ago (e.g., "5 min ago", "2 hours ago")
 * Accepts an optional translation function for i18n support.
 */
export function timeAgo(
  timestamp: string,
  t?: (key: string, opts?: Record<string, string | number>) => string,
): string {
  const minutes = getElapsedMinutes(timestamp);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (t) {
    if (minutes < 1) return t('customer:time.justNow');
    if (minutes < 60) return t('customer:time.minutesAgo', { count: minutes });
    if (hours < 24) return t('customer:time.hoursAgo', { count: hours });
    return t('customer:time.daysAgo', { count: days });
  }

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/**
 * Get status color class
 */
/**
 * Get localized field from a menu item or category.
 * Currently DB has single-language fields, so returns the field directly.
 */
export function getLocalizedField(
  item: { name?: string | null; description?: string | null },
  field: 'name' | 'description',
  _language?: string,
): string {
  return (item?.[field] as string) ?? '';
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
    case 'pending_approval':
      return 'bg-gray-500 text-white';
    case 'new':
      return 'bg-blue-500 text-white';
    case 'preparing':
      return 'bg-yellow-500 text-white';
    case 'ready':
      return 'bg-green-500 text-white';
    case 'served':
      return 'bg-purple-500 text-white';
    case 'out_for_delivery':
      return 'bg-indigo-500 text-white';
    case 'delivered':
      return 'bg-green-600 text-white';
    case 'paid':
      return 'bg-emerald-500 text-white';
    case 'cancelled':
      return 'bg-red-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}
