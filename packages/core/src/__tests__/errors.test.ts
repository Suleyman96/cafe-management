import { describe, expect, it } from 'vitest';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  getErrorMessage,
  isAppError,
  NetworkError,
  NotFoundError,
  ValidationError,
} from '../errors';

describe('AppError', () => {
  it('sets correct properties', () => {
    const error = new AppError('test', 'TEST_CODE', 500);
    expect(error.message).toBe('test');
    expect(error.code).toBe('TEST_CODE');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('AppError');
  });
});

describe('ValidationError', () => {
  it('has statusCode 400', () => {
    const error = new ValidationError('bad input');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('AuthenticationError', () => {
  it('has statusCode 401 and default message', () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Authentication required');
  });
});

describe('AuthorizationError', () => {
  it('has statusCode 403', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Insufficient permissions');
  });
});

describe('NotFoundError', () => {
  it('has statusCode 404 and includes resource name', () => {
    const error = new NotFoundError('Order');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Order not found');
  });
});

describe('ConflictError', () => {
  it('has statusCode 409', () => {
    const error = new ConflictError('Already exists');
    expect(error.statusCode).toBe(409);
  });
});

describe('isAppError', () => {
  it('returns true for AppError', () => {
    expect(isAppError(new AppError('test', 'TEST', 500))).toBe(true);
  });

  it('returns true for subclasses', () => {
    expect(isAppError(new ValidationError('test'))).toBe(true);
  });

  it('returns false for regular Error', () => {
    expect(isAppError(new Error('test'))).toBe(false);
  });
});

describe('getErrorMessage', () => {
  it('returns string directly', () => {
    expect(getErrorMessage('something failed')).toBe('something failed');
  });

  it('returns Error message', () => {
    expect(getErrorMessage(new Error('oops'))).toBe('oops');
  });

  it('returns message from object', () => {
    expect(getErrorMessage({ message: 'obj error' })).toBe('obj error');
  });

  it('returns default for unknown', () => {
    expect(getErrorMessage(42)).toBe('An unexpected error occurred');
  });

  it('returns default for null', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
  });

  it('returns default for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('An unexpected error occurred');
  });

  it('returns empty string from Error with empty message', () => {
    expect(getErrorMessage(new Error(''))).toBe('');
  });
});

describe('NetworkError', () => {
  it('has statusCode 0', () => {
    const error = new NetworkError();
    expect(error.statusCode).toBe(0);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toBe('Network error');
  });
});

describe('Error inheritance', () => {
  it('ValidationError instanceof AppError', () => {
    expect(new ValidationError('x') instanceof AppError).toBe(true);
  });

  it('ValidationError instanceof ValidationError', () => {
    expect(new ValidationError('x') instanceof ValidationError).toBe(true);
  });
});
