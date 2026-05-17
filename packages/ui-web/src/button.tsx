import type { ButtonContract } from '@gustri/design-tokens';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from './lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-target',
  {
    variants: {
      variant: {
        // `primary` is the contract name (see `ButtonContract` in
        // `@gustri/design-tokens`); `default` is kept as the legacy alias for
        // the same Tailwind classes so existing call sites
        // (`<Button variant="default">` or no variant) keep working.
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Contract size names: `sm`, `md`, `lg`, `icon`. `default` is the
        // legacy alias for `md`; `xl` is web-only (no mobile equivalent).
        md: 'h-10 px-4 py-2',
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-12 rounded-md px-8 text-base',
        xl: 'h-14 rounded-lg px-10 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

/**
 * Web button props. Adopts `loading` / `disabled` / `testID` from
 * `ButtonContract` (in `@gustri/design-tokens`) and the wider variant/size
 * unions from the CVA recipe. Web carries two extras the contract doesn't —
 * `default` (legacy alias for `primary`), `link`, `xl` — so consumers using
 * `<Button variant="default">` or `<Button size="xl">` keep working.
 */
export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'>,
    Omit<ButtonContract, 'variant' | 'size'> {
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  /** Optional leading icon — typically a `lucide-react` icon. */
  icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, icon, children, testID, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        data-testid={testID}
        {...props}
      >
        {loading ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : (
          <>
            {icon ? <span className="mr-2 inline-flex items-center">{icon}</span> : null}
            {children}
          </>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
