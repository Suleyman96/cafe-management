import { SPACING } from '@gustri/design-tokens';
import type { Config } from 'tailwindcss';

/** Mirror the shared spacing scale as a Tailwind extension. Tailwind expects
 * string values with units, so we suffix the numeric token values with `px`.
 * Lets `gap-md`, `p-lg`, … on web resolve to the same pixel values as
 * `style={{ padding: SPACING.lg }}` on mobile. */
const sharedSpacing = Object.fromEntries(Object.entries(SPACING).map(([k, v]) => [k, `${v}px`]));

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // Shared UI package — without this, Tailwind purges classes it doesn't
    // see in this app's source (e.g. LoadingSpinner's `animate-spin`,
    // `border-t-blue-500`), leaving a static grey ring instead of a spinner.
    '../../packages/ui-web/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand teal palette (overrides default blue)
        blue: {
          50: '#f0fafb',
          100: '#d4eff4',
          200: '#aee0ea',
          300: '#7acad9',
          400: '#4aadc1',
          500: '#367B8B',
          600: '#2d6878',
          700: '#285766',
          800: '#274856',
          900: '#243d49',
          950: '#132730',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          // Numeric brand-teal scale (matches the `blue` palette above; `500`
          // equals the `--primary` DEFAULT). Without these, common utilities
          // like `bg-primary-500` / `from-primary-50` silently resolve to
          // nothing — which left the cafe-login button invisible (white text,
          // no background) and the onboarding/platform-header accents unstyled.
          50: '#f0fafb',
          100: '#d4eff4',
          200: '#aee0ea',
          300: '#7acad9',
          400: '#4aadc1',
          500: '#367B8B',
          600: '#2d6878',
          700: '#285766',
          800: '#274856',
          900: '#243d49',
          950: '#132730',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Status colors from shared constants
        status: {
          new: '#EF4444',
          preparing: '#F59E0B',
          ready: '#10B981',
          served: '#6B7280',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      spacing: sharedSpacing,
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
