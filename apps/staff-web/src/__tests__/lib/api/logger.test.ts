import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/api/logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger (ADD-9)', () => {
  it('emits a single line of parseable JSON with level, msg, ts and fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('order_created', { request_id: 'rid-1', route: '/api/v1/orders', status: 201 });

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]![0] as string;
    expect(line).not.toContain('\n');
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 'info',
      msg: 'order_created',
      request_id: 'rid-1',
      route: '/api/v1/orders',
      status: 201,
    });
    expect(typeof parsed.ts).toBe('string');
    expect(() => new Date(parsed.ts).toISOString()).not.toThrow();
  });

  it('routes error level to console.error', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('boom', { request_id: 'rid-2' });
    expect(err).toHaveBeenCalledTimes(1);
    expect(JSON.parse(err.mock.calls[0]![0] as string).level).toBe('error');
  });

  it('routes warn level to console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('careful', {});
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warn.mock.calls[0]![0] as string).level).toBe('warn');
  });

  it('works with no fields', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('bare');
    expect(JSON.parse(spy.mock.calls[0]![0] as string).msg).toBe('bare');
  });
});
