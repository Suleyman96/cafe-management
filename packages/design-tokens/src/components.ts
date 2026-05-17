/**
 * Shared component prop contracts.
 *
 * Both `@gustri/ui-web` (CVA + Tailwind) and `@gustri/ui-mobile`
 * (`react-native-paper` wrappers) implement components that satisfy these
 * shapes. A waiter or kitchen staff member switching between phone and the
 * front-of-house tablet should get the same vocabulary — `<Button
 * variant="destructive" />` paints the same red on both surfaces.
 *
 * Headless boundary — never import React or react-native here. Platform
 * packages extend these contracts with their own React-typed `icon` /
 * `children` props (e.g. `icon?: ReactNode` on web).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

/**
 * Shared variants/sizes for `Button` across web + mobile. Platform packages
 * extend this with their own typed `icon` / `children` props.
 */
export interface ButtonContract {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner inside the button and disables interaction. */
  loading?: boolean;
  /** Disables the button — both visually and pointer-events. */
  disabled?: boolean;
  /** Optional test ID — matches the `testID` prop RN uses and the `data-testid` web uses. */
  testID?: string;
}

export type BadgeVariant = 'solid' | 'outline';

export interface BadgeContract {
  variant?: BadgeVariant;
  /** Whether the badge should pulse — overrides the `BadgeConfig.pulse` default. */
  pulse?: boolean;
}

export type CardElevation = 'rest' | 'hover' | 'active';

export interface CardContract {
  elevation?: CardElevation;
  /** Optional border color hex / Tailwind class — for type-coded cards (e.g. dine-in vs delivery). */
  borderColor?: string;
}

export type SheetSize = 'sm' | 'md' | 'lg' | 'full';

export interface SheetContract {
  size?: SheetSize;
  /** Whether the sheet can be dismissed via the scrim — defaults to true. */
  dismissible?: boolean;
}

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerContract {
  size?: SpinnerSize;
}
