import { describe, expect, it } from 'vitest';
import { isTimeoutError, TimeoutError, withTimeout } from '@/lib/supabase/with-timeout';

describe('withTimeout', () => {
  it('resolves when the promise settles before the deadline', async () => {
    const result = await withTimeout(Promise.resolve(42), 100, 'test');
    expect(result).toBe(42);
  });

  it('rejects with TimeoutError when the deadline expires first', async () => {
    const stuck = new Promise(() => {}); // never resolves
    await expect(withTimeout(stuck, 10, 'getSession')).rejects.toBeInstanceOf(TimeoutError);
  });

  it('attaches the label and ms on the TimeoutError', async () => {
    const stuck = new Promise(() => {});
    try {
      await withTimeout(stuck, 15, 'getSession(cold)');
      throw new Error('expected timeout');
    } catch (err) {
      expect(isTimeoutError(err)).toBe(true);
      if (isTimeoutError(err)) {
        expect(err.label).toBe('getSession(cold)');
        expect(err.ms).toBe(15);
      }
    }
  });

  it('propagates the underlying rejection unchanged', async () => {
    const original = new Error('upstream');
    await expect(withTimeout(Promise.reject(original), 100, 'test')).rejects.toBe(original);
  });

  it('does not reject after the underlying promise has resolved', async () => {
    // Resolve immediately; wait past the timeout window and confirm no
    // late TimeoutError fires (would surface as an unhandled rejection).
    const result = await withTimeout(Promise.resolve('ok'), 5, 'test');
    expect(result).toBe('ok');
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});
