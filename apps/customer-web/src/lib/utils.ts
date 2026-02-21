import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price with currency symbol
 */
export function formatPrice(amount: number, currency: string = '€'): string {
  return `${currency}${amount.toFixed(2)}`;
}

/**
 * Calculate elapsed time in minutes
 */
export function getElapsedMinutes(timestamp: string): number {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  return Math.floor((now - then) / 1000 / 60);
}

/**
 * Format time ago (e.g., "5 min ago", "2 hours ago")
 */
export function timeAgo(timestamp: string): string {
  const minutes = getElapsedMinutes(timestamp);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'new':
      return 'status-new';
    case 'preparing':
      return 'status-preparing';
    case 'ready':
      return 'status-ready';
    case 'served':
      return 'status-served';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
