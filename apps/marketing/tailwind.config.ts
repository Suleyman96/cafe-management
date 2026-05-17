import { SPACING } from '@gustri/design-tokens';
import type { Config } from 'tailwindcss';

/** Mirror the shared spacing scale as a Tailwind extension (see staff-web
 * tailwind.config.ts for the rationale). */
const sharedSpacing = Object.fromEntries(Object.entries(SPACING).map(([k, v]) => [k, `${v}px`]));

const config: Config = {
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
        primary: {
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: sharedSpacing,
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
