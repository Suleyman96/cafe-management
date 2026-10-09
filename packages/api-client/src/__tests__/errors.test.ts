import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NetworkError,
  NotFoundError,
  ValidationError,
} from '@gustri/core';
import { describe, expect, it } from 'vitest';
import { handleSupabaseError, httpStatusToAppError } from '../errors';

describe('handleSupabaseError', () => {
  it('maps PGRST301 to AuthenticationError', () => {
    const error = handleSupabaseError({ code: 'PGRST301' });
    expect(error).toBeInstanceOf(AuthenticationError);
  });

  it('maps 23505 to ConflictError', () => {
    const error = handleSupabaseError({ code: '23505' });
    expect(error).toBeInstanceOf(ConflictError);
  });

  it('maps 23503 to ValidationError', () => {
    const error = handleSupabaseError({ code: '23503' });
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('maps PGRST116 to NotFoundError', () => {
    const error = handleSupabaseError({
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    });
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('maps P0002 (no_data_found) to NotFoundError with the RPC sentinel message preserved', () => {
    // NotFoundError's constructor wraps `resource` as `${resource} not found`,
    // so the assertion checks the sentinel survives the wrap rather than
    // matching equality.
    const error = handleSupabaseError({
      code: 'P0002',
      message: 'order_not_found_in_tenant',
    });
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toContain('order_not_found_in_tenant');
  });

  it('maps P0002 with waiter_call_already_acknowledged to ConflictError', () => {
    const error = handleSupabaseError({
      code: 'P0002',
      message: 'waiter_call_already_acknowledged',
    });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.message).toBe('waiter_call_already_acknowledged');
  });

  it('maps P0002 with waiter_call_already_resolved to ConflictError', () => {
    const error = handleSupabaseError({
      code: 'P0002',
      message: 'waiter_call_already_resolved',
    });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.message).toBe('waiter_call_already_resolved');
  });

  it('maps 42501 to AuthorizationError', () => {
    const error = handleSupabaseError({
      code: '42501',
      message: 'permission denied for table orders',
    });
    expect(error).toBeInstanceOf(AuthorizationError);
  });

  it('maps P0001 with plan_required to AuthorizationError', () => {
    // Friendly-error layer for the table-cap trigger: raises
    // plan_required (P0001) so the user gets the localized
    // "upgrade your plan" message instead of the bare RLS rejection.
    const error = handleSupabaseError({
      code: 'P0001',
      message: 'plan_required',
    });
    expect(error).toBeInstanceOf(AuthorizationError);
    expect(error.message).toBe('plan_required');
  });

  it('maps 23514 to ValidationError', () => {
    const error = handleSupabaseError({
      code: '23514',
      message: 'new row violates check constraint',
    });
    expect(error).toBeInstanceOf(ValidationError);
  });

  it.each([
    'payment_exceeds_remaining',
    'refund_exceeds_available',
    'payment_tenant_mismatch',
    'refund_tenant_mismatch',
    // Channel-policy enforcement (migration 20260517000005). Sentinel
    // raised by the order_items BEFORE INSERT trigger when a takeout
    // order tries to include a non-takeoutable item (or delivery + a
    // non-deliverable item). Must round-trip as ConflictError so the
    // mutation cache's onError → localizeErrorMessage finds the i18n
    // key in errors.json.
    'menu_item_not_takeoutable',
    'menu_item_not_deliverable',
  ])('maps 23514 with sentinel %s to ConflictError', (sentinel) => {
    const error = handleSupabaseError({ code: '23514', message: sentinel });
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.message).toBe(sentinel);
  });

  it('maps status 404 to NotFoundError', () => {
    const error = handleSupabaseError({ status: 404 });
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it('maps status 401 to AuthenticationError', () => {
    const error = handleSupabaseError({ status: 401 });
    expect(error).toBeInstanceOf(AuthenticationError);
  });

  it('maps status 403 to AuthorizationError', () => {
    const error = handleSupabaseError({ status: 403 });
    expect(error).toBeInstanceOf(AuthorizationError);
  });

  it('code takes priority over status when both are present', () => {
    const error = handleSupabaseError({ code: '23505', status: 404 });
    expect(error).toBeInstanceOf(ConflictError);
  });

  it('maps NETWORK_ERROR code to NetworkError', () => {
    const error = handleSupabaseError({ code: 'NETWORK_ERROR' });
    expect(error).toBeInstanceOf(NetworkError);
  });

  it('returns default AppError for null', () => {
    const error = handleSupabaseError(null);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('UNKNOWN_ERROR');
  });

  it('returns default AppError for undefined', () => {
    const error = handleSupabaseError(undefined);
    expect(error).toBeInstanceOf(AppError);
  });

  it('returns default AppError for unknown error shape', () => {
    const error = handleSupabaseError({ something: 'unknown' });
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(500);
  });

  // ─── L9: no raw DB text in user-facing messages ──────────────────
  describe('L9 — raw provider text is not leaked into the message', () => {
    it('42501 uses a generic message and keeps the raw text in details', () => {
      const error = handleSupabaseError({
        code: '42501',
        message: 'permission denied for table orders',
        details: 'internal detail',
      });
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe('Insufficient privileges');
      expect(error.message).not.toContain('permission denied');
      expect(error.details?.rawMessage).toBe('permission denied for table orders');
      expect(error.details?.rawDetails).toBe('internal detail');
    });

    it('non-sentinel 23514 uses a generic message and keeps raw text in details', () => {
      const error = handleSupabaseError({
        code: '23514',
        message: 'new row for relation "orders" violates check constraint "chk_total"',
      });
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Value violates constraint');
      expect(error.details?.rawMessage).toContain('check constraint');
    });

    it('non-sentinel P0002 (raw prose) uses a generic message, raw in details', () => {
      const error = handleSupabaseError({
        code: 'P0002',
        message: 'record "x" does not exist at line 42',
      });
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe('Resource not found');
      expect(error.message).not.toContain('line 42');
      expect(error.details?.rawMessage).toContain('line 42');
    });

    it('snake_case sentinel on P0002 IS preserved (localization code, not raw text)', () => {
      const error = handleSupabaseError({ code: 'P0002', message: 'order_not_found_in_tenant' });
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toContain('order_not_found_in_tenant');
    });

    it('generic fallback uses a generic message and keeps raw text in details', () => {
      const error = handleSupabaseError({
        code: 'XX999',
        status: 500,
        message: 'internal: connection to 10.0.0.5 refused',
      });
      expect(error.message).toBe('An unexpected error occurred');
      expect(error.message).not.toContain('10.0.0.5');
      expect(error.code).toBe('XX999');
      expect(error.details?.rawMessage).toContain('10.0.0.5');
    });
  });
});

describe('httpStatusToAppError', () => {
  it('maps 400 to ValidationError', () => {
    const err = httpStatusToAppError(400, { error: 'bad input', details: { fieldErrors: {} } });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('bad input');
    expect(err.details).toEqual({ fieldErrors: {} });
  });

  it('maps 422 to ValidationError', () => {
    const err = httpStatusToAppError(422, { error: 'unprocessable' });
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('maps 401 to AuthenticationError', () => {
    const err = httpStatusToAppError(401, { error: 'expired token' });
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.message).toBe('expired token');
  });

  it('maps 403 to AuthorizationError', () => {
    const err = httpStatusToAppError(403, { error: 'forbidden' });
    expect(err).toBeInstanceOf(AuthorizationError);
  });

  it('maps 404 to NotFoundError', () => {
    const err = httpStatusToAppError(404, { error: 'missing' });
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it('maps 409 to ConflictError', () => {
    const err = httpStatusToAppError(409, { error: 'already exists' });
    expect(err).toBeInstanceOf(ConflictError);
  });

  it('maps 5xx to SERVER_ERROR AppError', () => {
    const err = httpStatusToAppError(503, { error: 'unavailable' });
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('SERVER_ERROR');
    expect(err.statusCode).toBe(503);
  });

  it('falls back to fallbackMessage when body has no error field', () => {
    const err = httpStatusToAppError(400, null, 'fallback msg');
    expect(err.message).toBe('fallback msg');
  });

  it('uses generic AppError for unmapped statuses', () => {
    const err = httpStatusToAppError(418, { error: "I'm a teapot" });
    expect(err.code).toBe('HTTP_ERROR');
    expect(err.statusCode).toBe(418);
  });

  describe('request_id correlation (ADD-9)', () => {
    it('attaches body.request_id to details on a subclass that takes no details (401)', () => {
      const err = httpStatusToAppError(401, { error: 'expired token', request_id: 'rid-401' });
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.details).toEqual({ request_id: 'rid-401' });
    });

    it('merges request_id alongside existing fieldErrors details (400)', () => {
      const err = httpStatusToAppError(400, {
        error: 'bad input',
        details: { fieldErrors: { name: ['required'] } },
        request_id: 'rid-400',
      });
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.details).toEqual({
        fieldErrors: { name: ['required'] },
        request_id: 'rid-400',
      });
    });

    it('attaches request_id on a 5xx server error', () => {
      const err = httpStatusToAppError(500, { error: 'boom', request_id: 'rid-500' });
      expect(err.details?.request_id).toBe('rid-500');
    });

    it('leaves details undefined when no request_id is present', () => {
      const err = httpStatusToAppError(403, { error: 'forbidden' });
      expect(err.details).toBeUndefined();
    });
  });
});
