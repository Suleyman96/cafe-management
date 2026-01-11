/**
 * Shared Utility Functions
 * Platform-agnostic utilities used across all apps
 */

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
  const now = new Date().getTime();
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
 * Get status color name
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'new':
      return 'red';
    case 'preparing':
      return 'yellow';
    case 'ready':
      return 'green';
    case 'served':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get status emoji
 */
export function getStatusEmoji(status: string): string {
  switch (status) {
    case 'new':
      return '🔴';
    case 'preparing':
      return '🟡';
    case 'ready':
      return '🟢';
    case 'served':
      return '⚪';
    case 'closed':
      return '⚫';
    default:
      return '⚪';
  }
}

/**
 * Calculate tax amount
 */
export function calculateTax(subtotal: number, taxRate: number = 0.18): number {
  return subtotal * taxRate;
}

/**
 * Calculate total with tax
 */
export function calculateTotal(subtotal: number, taxRate: number = 0.18): number {
  return subtotal + calculateTax(subtotal, taxRate);
}

// Removed formatDate and formatTime to avoid duplicates with formatters.ts

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate initials from full name
 */
export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Removed isValidEmail to avoid duplicates with validators.ts

/**
 * Generate random ID (for optimistic updates)
 */
export function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}


