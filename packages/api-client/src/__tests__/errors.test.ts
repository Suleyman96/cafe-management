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

  it('maps 42501 to AuthorizationError', () => {
    const error = handleSupabaseError({
      code: '42501',
      message: 'permission denied for table orders',
    });
    expect(error).toBeInstanceOf(AuthorizationError);
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
});
