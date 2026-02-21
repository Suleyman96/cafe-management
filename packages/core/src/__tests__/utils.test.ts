import { describe, expect, it, vi } from 'vitest';
import {
  calculateTax,
  calculateTotal,
  debounce,
  formatPrice,
  generateTempId,
  getElapsedMinutes,
  getInitials,
  getStatusColor,
  getStatusEmoji,
  timeAgo,
} from '../utils';

describe('formatPrice', () => {
  it('formats with default euro currency', () => {
    expect(formatPrice(10)).toBe('€10.00');
  });

  it('formats with custom currency symbol', () => {
    expect(formatPrice(10, '$')).toBe('$10.00');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('€0.00');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatPrice(10.999)).toBe('€11.00');
  });
});

describe('calculateTax', () => {
  it('calculates with default 18% rate', () => {
    expect(calculateTax(100)).toBe(18);
  });

  it('calculates with custom rate', () => {
    expect(calculateTax(100, 0.1)).toBe(10);
  });

  it('returns 0 for zero subtotal', () => {
    expect(calculateTax(0)).toBe(0);
  });
});

describe('calculateTotal', () => {
  it('calculates total with default 18% tax', () => {
    expect(calculateTotal(100)).toBe(118);
  });

  it('calculates total with custom tax rate', () => {
    expect(calculateTotal(100, 0.1)).toBe(110);
  });
});

describe('getElapsedMinutes', () => {
  it('returns correct minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(getElapsedMinutes(fiveMinAgo)).toBe(5);
  });

  it('returns 0 for current time', () => {
    expect(getElapsedMinutes(new Date().toISOString())).toBe(0);
  });
});

describe('timeAgo', () => {
  it('returns "just now" for recent timestamps', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5 min ago');
  });

  it('returns hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2 hours ago');
  });

  it('returns singular hour', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneHourAgo)).toBe('1 hour ago');
  });

  it('returns days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe('3 days ago');
  });
});

describe('getStatusColor', () => {
  it('returns red for new', () => {
    expect(getStatusColor('new')).toBe('red');
  });

  it('returns yellow for preparing', () => {
    expect(getStatusColor('preparing')).toBe('yellow');
  });

  it('returns green for ready', () => {
    expect(getStatusColor('ready')).toBe('green');
  });

  it('returns gray for served', () => {
    expect(getStatusColor('served')).toBe('gray');
  });

  it('returns gray for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('gray');
  });
});

describe('getStatusEmoji', () => {
  it('returns correct emojis for each status', () => {
    expect(getStatusEmoji('new')).toBe('🔴');
    expect(getStatusEmoji('preparing')).toBe('🟡');
    expect(getStatusEmoji('ready')).toBe('🟢');
    expect(getStatusEmoji('served')).toBe('⚪');
    expect(getStatusEmoji('closed')).toBe('⚫');
    expect(getStatusEmoji('unknown')).toBe('⚪');
  });
});

describe('getInitials', () => {
  it('returns initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns single initial for single name', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  it('limits to 2 characters', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });
});

describe('debounce', () => {
  it('calls function after delay', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('resets timer on subsequent calls', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });
});

describe('generateTempId', () => {
  it('starts with "temp_"', () => {
    expect(generateTempId()).toMatch(/^temp_/);
  });

  it('generates unique IDs', () => {
    const id1 = generateTempId();
    const id2 = generateTempId();
    expect(id1).not.toBe(id2);
  });
});
