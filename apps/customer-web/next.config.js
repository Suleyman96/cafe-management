const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// H5 — build-time guard. `NEXT_PUBLIC_API_BASE_URL` is the origin of the
// staff-web `/api/v1/customer/*` routes. If it's unset in a production
// build, two things silently break:
//   1. The middleware-emitted CSP's `connect-src` hint becomes the empty
//      string and the browser blocks every customer mutation.
//   2. `apiFetch` POSTs hit the dev-only `http://localhost:3001` fallback
//      and never reach the real staff-web origin.
// Both fail with no user-visible error. Fail fast at build instead.
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  throw new Error(
    'NEXT_PUBLIC_API_BASE_URL must be set for production builds — without it, customer mutations silently fail (CSP blocks the staff-web origin and apiFetch posts to localhost).',
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  reactStrictMode: true,
  // Important: transpile workspace packages
  transpilePackages: [
    '@gustri/api-client',
    '@gustri/core',
    '@gustri/database',
    '@gustri/i18n',
    '@gustri/queries',
    '@gustri/ui',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // CSP intentionally NOT set here — it's emitted per-request by
          // src/middleware.ts so the policy can carry a fresh nonce that
          // Next.js stamps onto its inline hydration `<script>` blocks.
          // Setting CSP statically here would override the middleware
          // header on first paint (the static one wins) and break
          // hydration with "Executing inline script violates the
          // following Content Security Policy" — which is exactly what
          // was leaving the customer menu page stuck on the loading
          // skeleton.
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Replaces the deprecated `disableLogger: true`. Strips Sentry's debug
  // `console.*` calls from the production bundle via webpack treeshake
  // rather than via a Sentry-specific flag that's slated for removal.
  webpack: { treeshake: { removeDebugLogging: true } },
});
