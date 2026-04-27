import { describe, expect, it } from 'vitest';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  httpStatusToAppError,
  NotFoundError,
  ValidationError,
} from '../errors';

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
