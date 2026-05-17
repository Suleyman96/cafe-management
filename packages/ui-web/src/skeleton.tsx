import { cn } from './lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Pulsing rectangle stand-in for not-yet-loaded content. Designed to be
 * composed into screen-specific skeleton layouts (e.g. a row of skeleton
 * cards) rather than used as a one-size-fits-all spinner replacement.
 *
 * Geometry comes from the caller via `className` (width / height /
 * rounded corners). Default is a neutral light-gray pulse.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-gray-200', className)} />;
}
