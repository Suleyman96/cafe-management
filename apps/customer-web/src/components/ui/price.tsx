'use client';

import { Skeleton } from '@gustri/ui-web';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCafeSettings } from '@/hooks/use-settings';
import { cn } from '@/lib/utils';

interface PriceProps {
  amount: number;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Skeleton geometry while settings are still placeholder. Defaults
   * to a single-line ~3-character width. Pass an explicit value when
   * the surrounding type scale is larger (e.g. the cart-summary total
   * which uses `text-2xl`).
   */
  skeletonClassName?: string;
}

/**
 * P4 — currency-flicker guard for price displays.
 *
 * `useCafeSettings` returns `placeholderData: DEFAULT_SETTINGS` (`$` /
 * USD / "Restaurant") so the first paint has *something* to render
 * instead of `undefined`-blanking the layout. The pre-fix consequence
 * on slow networks: a price renders as `$5`, then snaps to `₺250` once
 * the real settings resolve. Trust hit, looks broken.
 *
 * This component swaps the placeholder render for a pulse-skeleton of
 * the right rough size, so the layout stays stable but the wrong
 * currency never paints. Once `isPlaceholderData` flips to false the
 * formatter takes over.
 */
export function Price({ amount, className, style, skeletonClassName }: PriceProps) {
  const { isPlaceholderData } = useCafeSettings();
  const formatPrice = useFormatPrice();

  if (isPlaceholderData) {
    return (
      <span
        className={cn('inline-block align-middle', className)}
        style={style}
        aria-hidden="true"
        data-testid="price-skeleton"
      >
        <Skeleton className={cn('h-4 w-12 bg-white/[0.08]', skeletonClassName)} />
      </span>
    );
  }

  return (
    <span className={className} style={style}>
      {formatPrice(amount)}
    </span>
  );
}
