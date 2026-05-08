const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Build identifier — set by Vercel; falls back to 'dev' for local builds.
// Exposed to the client via NEXT_PUBLIC_BUILD_SHA so the running tab can
// compare against /api/v1/health and detect a deploy that landed while
// the user kept the page open. Also pinned as Next's generateBuildId so
// _next asset URLs match the SHA, which lets the service worker scope its
// cache by deploy and purge on activate.
const COMMIT_SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? 'dev';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: COMMIT_SHA,
  },
  generateBuildId: async () => COMMIT_SHA,
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
  experimental: {
    instrumentationHook: true,
  },
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
          // Next.js bootstraps React via inline <script> tags (the
          // __NEXT_DATA__ blob, chunk loaders, runtime patches). Strict
          // `script-src 'self'` blocks them and hydration silently fails —
          // the page renders, but onSubmit handlers never attach so forms
          // fall back to native HTML submission.
          //
          // TODO: migrate to a nonce-based CSP (Next.js supports this via
          // middleware) so we can drop 'unsafe-inline' / 'unsafe-eval'.
          // Until then, allow them in production so the app actually works.
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Content-Security-Policy',
                  value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                    "style-src 'self' 'unsafe-inline'",
                    `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL || ''} wss://*.supabase.co https://*.sentry.io`,
                    "img-src 'self' data: blob: https://*.supabase.co",
                    "font-src 'self'",
                    "frame-ancestors 'none'",
                    "base-uri 'self'",
                    "form-action 'self'",
                  ].join('; '),
                },
              ]
            : []),
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
