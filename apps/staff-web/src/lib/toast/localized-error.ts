import { isAppError } from '@gustri/core';
import { localizeErrorMessage } from '@gustri/i18n';
import { toast } from 'sonner';

/**
 * Show an error toast, translating known server sentinels via the
 * `errors` i18n namespace and deduplicating identical messages.
 *
 * Why this exists:
 *  - The global mutation-cache `onError` in `providers.tsx` already
 *    localizes mutation rejections, but components also catch
 *    `mutateAsync` rejections themselves (for `setLoading(false)`,
 *    form state cleanup, etc.) and used to call `toast.error(error.
 *    message)` directly. That raw call surfaced the un-translated
 *    sentinel (e.g. literal `plan_required`) AND stacked a second
 *    toast on top of the cache handler's translated one.
 *  - This helper folds the same `isAppError → localizeErrorMessage`
 *    logic the cache handler uses, plus a sonner `id` derived from
 *    the resolved message so duplicate emits dedupe instead of
 *    stacking.
 *
 * `fallback` is shown for non-AppError throws (network blips, etc.)
 * AND used by `localizeErrorMessage` when a sentinel-shaped message
 * has no translation in the active locale.
 */
export function toastLocalizedError(
  error: unknown,
  fallback: string,
  options?: { id?: string | number },
): void {
  const message = isAppError(error) ? localizeErrorMessage(error.message, fallback) : fallback;
  // Callers that own a pre-existing toast lifecycle (e.g. a `toast.loading`
  // spinner that needs to be replaced in place) pass their own `id`.
  // Everyone else dedupes by message so the cache handler + a component
  // catch collapse to a single toast.
  toast.error(message, { id: options?.id ?? message });
}
