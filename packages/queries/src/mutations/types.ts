/**
 * Shared types for mutation hooks.
 */

/**
 * Optional callbacks that app-level code can provide to mutation hooks.
 * Keeps shared mutation hooks decoupled from any UI framework (toasts, etc.).
 */
export type MutationCallbacks = {
  onError?: (error: Error) => void;
};
