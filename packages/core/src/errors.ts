/**
 * Error handling utilities
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHZ_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string = 'Network error') {
    super(message, 'NETWORK_ERROR', 0);
    this.name = 'NetworkError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return 'An unexpected error occurred';
}

export function handleSupabaseError(error: unknown): AppError {
  if (error == null) {
    return new AppError('An unexpected error occurred', 'UNKNOWN_ERROR', 500);
  }
  const err = error as { code?: string; status?: number; message?: string; details?: string };

  // Handle Supabase-specific errors
  if (err.code === 'PGRST301') {
    return new AuthenticationError();
  }

  if (err.code === '23505') {
    return new ConflictError('Resource already exists');
  }

  if (err.code === '23503') {
    return new ValidationError('Referenced resource does not exist');
  }

  // PostgREST: .single() returned 0 or multiple rows
  if (err.code === 'PGRST116') {
    return new NotFoundError(err.details || 'Resource');
  }

  // PostgreSQL: RLS or insufficient privilege
  if (err.code === '42501') {
    return new AuthorizationError(err.message || 'Insufficient privileges');
  }

  // PostgreSQL: CHECK constraint violation
  if (err.code === '23514') {
    return new ValidationError(err.message || 'Value violates constraint');
  }

  if (err.status === 404) {
    return new NotFoundError('Resource');
  }

  if (err.status === 401) {
    return new AuthenticationError();
  }

  if (err.status === 403) {
    return new AuthorizationError();
  }

  // Network errors
  if ((typeof navigator !== 'undefined' && !navigator.onLine) || err.code === 'NETWORK_ERROR') {
    return new NetworkError();
  }

  // Default error
  return new AppError(getErrorMessage(error), err.code || 'UNKNOWN_ERROR', err.status || 500);
}
