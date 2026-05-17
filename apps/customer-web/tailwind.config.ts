import { SPACING } from '@gustri/design-tokens';
import type { Config } from 'tailwindcss';

/** Mirror the shared spacing scale as a Tailwind extension (see staff-web
 * tailwind.config.ts for the rationale). */
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
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
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
        glass: {
          subtle: 'rgba(255,255,255,0.04)',
          border: 'rgba(255,255,255,0.06)',
          light: 'rgba(255,255,255,0.08)',
          medium: 'rgba(255,255,255,0.1)',
        },
        status: {
          new: 'hsl(0, 84%, 60%)', // Red
          preparing: 'hsl(45, 93%, 47%)', // Orange
          ready: 'hsl(142, 71%, 45%)', // Green
          served: 'hsl(0, 0%, 60%)', // Gray
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      spacing: sharedSpacing,
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
