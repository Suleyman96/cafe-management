import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export function LoadingSpinner({
  className,
  size = 'md',
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const spinner = <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />;

  if (fullScreen) {
    return <div className="flex h-screen w-full items-center justify-center">{spinner}</div>;
  }

  return spinner;
}
