import { AppError, AuthorizationError, ValidationError } from '@gustri/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
const setTag = vi.fn();
const withScope = vi.fn((cb: (scope: { setTag: typeof setTag }) => void) => cb({ setTag }));

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  withScope: (cb: (scope: { setTag: typeof setTag }) => void) => withScope(cb),
}));

const { handleRouteError } = await import('@/lib/api/handle-route-error');
const { REQUEST_ID_HEADER } = await import('@/lib/api/request-id');

function reqWith(id: string | null, url = 'http://localhost:3001/api/v1/orders') {
  const headers = new Headers();
  if (id) headers.set(REQUEST_ID_HEADER, id);
  return { headers, method: 'POST', url } as unknown as Request;
}

beforeEach(() => {
  // keep console quiet + deterministic
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('handleRouteError (ADD-9 correlation)', () => {
  it('echoes the inbound request_id in body + x-request-id header for an unhandled 500', async () => {
    const res = handleRouteError(new Error('kaboom'), reqWith('rid-abc'));
    expect(res.status).toBe(500);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe('rid-abc');
    const body = await res.json();
    expect(body.request_id).toBe('rid-abc');
    expect(body.error).toBe('An error occurred processing your request');
  });

  it('reports unhandled errors to Sentry tagged with request_id + route', () => {
    handleRouteError(new Error('kaboom'), reqWith('rid-tag'));
    expect(withScope).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(setTag).toHaveBeenCalledWith('request_id', 'rid-tag');
    expect(setTag).toHaveBeenCalledWith('route', '/api/v1/orders');
  });

  it('honors a typed AppError status and does NOT page Sentry for it', async () => {
    const res = handleRouteError(new AuthorizationError('plan_required'), reqWith('rid-403'));
    expect(res.status).toBe(403);
    expect(captureException).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toBe('plan_required');
    expect(body.request_id).toBe('rid-403');
  });

  it('returns a ValidationError status + message with request_id (details stay client-side)', async () => {
    // Behavior-preserving: handleRouteError has never echoed AppError.details
    // in the body — per-field Zod feedback is produced client-side via
    // validateOrThrow, not round-tripped through the server. ADD-9 only adds
    // request_id; it must not start leaking server-side error details.
    const err = new ValidationError('Validation failed', { fieldErrors: { name: ['required'] } });
    const res = handleRouteError(err, reqWith('rid-val'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(body.details).toBeUndefined();
    expect(body.request_id).toBe('rid-val');
  });

  it('maps a legacy sentinel string error via SAFE_ERRORS', async () => {
    const res = handleRouteError(new Error('payment_exceeds_remaining'), reqWith('rid-409'));
    expect(res.status).toBe(409);
    expect(captureException).not.toHaveBeenCalled();
    expect((await res.json()).error).toBe('payment_exceeds_remaining');
  });

  it('still returns a safe response when no request is supplied (back-compat)', async () => {
    const res = handleRouteError(new Error('kaboom'));
    expect(res.status).toBe(500);
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeNull();
    const body = await res.json();
    expect(body.request_id).toBeUndefined();
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('omits request_id (and the header) when the request lacks x-request-id', async () => {
    // No middleware in unit tests → no x-request-id header → no correlation
    // ID is emitted. We never mint an orphan ID that no log line references.
    const res = handleRouteError(new AppError('x', 'CODE', 500), reqWith(null));
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeNull();
    const body = await res.json();
    expect(body.request_id).toBeUndefined();
  });
});
