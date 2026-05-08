import * as Sentry from '@sentry/react-native';
import { describe, expect, it, vi } from 'vitest';
import { validateRealtimePayload } from '@/lib/realtime-validation';

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
}));

const passthroughSchema = {
  safeParse: (data: unknown) => ({ success: true as const, data }),
};

const failingSchema = {
  safeParse: () => ({ success: false as const, error: new Error('schema mismatch') }),
};

describe('validateRealtimePayload', () => {
  it('returns parsed data on success without touching Sentry', () => {
    vi.mocked(Sentry.captureException).mockClear();
    const out = validateRealtimePayload(
      passthroughSchema,
      { id: '1' },
      {
        table: 'orders',
        event: 'INSERT',
      },
    );
    expect(out).toEqual({ id: '1' });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('redacts PII from the reported payload on validation failure', () => {
    vi.mocked(Sentry.captureException).mockClear();
    const payload = {
      id: 'abc',
      customer_name: 'Alice',
      customer_phone: '+1-555-1234',
      delivery_address: '123 Main St',
      customer_notes: 'extra spicy',
      total: 25,
    };

    const out = validateRealtimePayload(failingSchema, payload, {
      table: 'orders',
      event: 'INSERT',
    });

    expect(out).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const opts = vi.mocked(Sentry.captureException).mock.calls[0][1] as {
      extra: { payload: Record<string, unknown> };
    };
    expect(opts.extra.payload).toEqual({
      id: 'abc',
      customer_name: '[redacted]',
      customer_phone: '[redacted]',
      delivery_address: '[redacted]',
      customer_notes: '[redacted]',
      total: 25,
    });
  });
});
