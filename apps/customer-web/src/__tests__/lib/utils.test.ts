import { debounce, formatPrice, getElapsedMinutes, getStatusColor, timeAgo } from '@/lib/utils';

// --- getStatusColor ---

describe('getStatusColor', () => {
  it('returns gray for "pending"', () => {
    expect(getStatusColor('pending')).toBe('bg-gray-500 text-white');
  });

  it('returns gray for "pending_approval"', () => {
    expect(getStatusColor('pending_approval')).toBe('bg-gray-500 text-white');
  });

  it('returns blue for "new"', () => {
    expect(getStatusColor('new')).toBe('bg-blue-500 text-white');
  });

  it('returns yellow for "preparing"', () => {
    expect(getStatusColor('preparing')).toBe('bg-yellow-500 text-white');
  });

  it('returns green for "ready"', () => {
    expect(getStatusColor('ready')).toBe('bg-green-500 text-white');
  });

  it('returns purple for "served"', () => {
    expect(getStatusColor('served')).toBe('bg-purple-500 text-white');
  });

  it('returns indigo for "out_for_delivery"', () => {
    expect(getStatusColor('out_for_delivery')).toBe('bg-indigo-500 text-white');
  });

  it('returns green-600 for "delivered"', () => {
    expect(getStatusColor('delivered')).toBe('bg-green-600 text-white');
  });

  it('returns emerald for "paid"', () => {
    expect(getStatusColor('paid')).toBe('bg-emerald-500 text-white');
  });

  it('returns red for "cancelled"', () => {
    expect(getStatusColor('cancelled')).toBe('bg-red-500 text-white');
  });

  it('returns gray fallback for unknown status', () => {
    expect(getStatusColor('unknown_status')).toBe('bg-gray-500 text-white');
  });
});

// --- formatPrice ---

describe('formatPrice', () => {
  it('formats with default EUR currency symbol', () => {
    expect(formatPrice(10.5)).toBe('€10.50');
  });

  it('formats with custom currency symbol', () => {
    expect(formatPrice(10.5, '$')).toBe('$10.50');
  });

  it('formats zero correctly', () => {
    expect(formatPrice(0)).toBe('€0.00');
  });

  it('formats whole number with two decimal places', () => {
    expect(formatPrice(7)).toBe('€7.00');
  });
});

// --- timeAgo ---

describe('timeAgo', () => {
  const FIXED_NOW = new Date('2026-03-27T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "just now" for less than 1 minute ago', () => {
    const timestamp = new Date(FIXED_NOW - 30 * 1000).toISOString(); // 30 seconds ago
    expect(timeAgo(timestamp)).toBe('just now');
  });

  it('returns "5 min ago" for 5 minutes ago', () => {
    const timestamp = new Date(FIXED_NOW - 5 * 60 * 1000).toISOString();
    expect(timeAgo(timestamp)).toBe('5 min ago');
  });

  it('returns "1 hour ago" for exactly 60 minutes', () => {
    const timestamp = new Date(FIXED_NOW - 60 * 60 * 1000).toISOString();
    expect(timeAgo(timestamp)).toBe('1 hour ago');
  });

  it('returns "2 hours ago" for 120 minutes', () => {
    const timestamp = new Date(FIXED_NOW - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(timestamp)).toBe('2 hours ago');
  });

  it('returns "1 day ago" for exactly 24 hours', () => {
    const timestamp = new Date(FIXED_NOW - 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(timestamp)).toBe('1 day ago');
  });

  it('returns "2 days ago" for 48 hours', () => {
    const timestamp = new Date(FIXED_NOW - 48 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(timestamp)).toBe('2 days ago');
  });
});

// --- getElapsedMinutes ---

describe('getElapsedMinutes', () => {
  const FIXED_NOW = new Date('2026-03-27T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 for a timestamp equal to now', () => {
    const timestamp = new Date(FIXED_NOW).toISOString();
    expect(getElapsedMinutes(timestamp)).toBe(0);
  });

  it('returns correct minutes for a known past timestamp', () => {
    const tenMinutesAgo = new Date(FIXED_NOW - 10 * 60 * 1000).toISOString();
    expect(getElapsedMinutes(tenMinutesAgo)).toBe(10);
  });

  it('floors partial minutes', () => {
    const nineAndHalfMinutesAgo = new Date(FIXED_NOW - 9.5 * 60 * 1000).toISOString();
    expect(getElapsedMinutes(nineAndHalfMinutesAgo)).toBe(9);
  });
});

// --- debounce ---

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays execution by the specified wait time', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels previous call when invoked again within wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(100);
    debounced(); // reset the timer

    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled(); // still waiting after second call

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the debounced function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('hello', 42);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('hello', 42);
  });

  it('uses arguments from the last invocation', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('first');
    debounced('second');
    debounced('third');

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });
});
