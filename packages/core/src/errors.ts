/**
 * Error handling utilities
 */

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
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

export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error?.message) return error.message;
  return 'An unexpected error occurred';
}

export function handleSupabaseError(error: any): AppError {
  // Handle Supabase-specific errors
  if (error?.code === 'PGRST301') {
    return new AuthenticationError();
  }
  
  if (error?.code === '23505') {
    return new ConflictError('Resource already exists');
  }
  
  if (error?.code === '23503') {
    return new ValidationError('Referenced resource does not exist');
  }
  
  if (error?.status === 404) {
    return new NotFoundError('Resource');
  }
  
  if (error?.status === 401) {
    return new AuthenticationError();
  }
  
  if (error?.status === 403) {
    return new AuthorizationError();
  }
  
  // Network errors
  if (!navigator.onLine || error?.code === 'NETWORK_ERROR') {
    return new NetworkError();
  }
  
  // Default error
  return new AppError(
    getErrorMessage(error),
    error?.code || 'UNKNOWN_ERROR',
    error?.status || 500,
    error
  );
}