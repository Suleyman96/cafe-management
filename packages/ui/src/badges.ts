/**
 * Tailwind utility class helpers for status / role badges.
 *
 * Lives here (not in `@gustri/core`) because the return values are Tailwind
 * class strings — a UI concern. Core stays headless and styling-agnostic.
 */

/** Returns Tailwind CSS classes for a staff role badge. */
export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-emerald-100 text-emerald-800';
    case 'admin':
      return 'bg-purple-100 text-purple-800';
    case 'kitchen':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
}

/** Returns Tailwind CSS classes for an order status badge/card. */
export function getOrderStatusColor(status: string): string {
  switch (status) {
    case 'pending_approval':
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    case 'new':
      return 'bg-blue-100 text-blue-800';
    case 'preparing':
      return 'bg-yellow-100 text-yellow-800';
    case 'ready':
      return 'bg-green-100 text-green-800';
    case 'served':
      return 'bg-purple-100 text-purple-800';
    case 'out_for_delivery':
      return 'bg-violet-100 text-violet-800';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800';
    case 'closed':
      return 'bg-gray-100 text-gray-800';
    case 'paid':
      return 'bg-gray-100 text-gray-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
