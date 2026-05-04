const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

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
          // CSP disabled in development — Next.js requires inline scripts for hydration.
          // Re-enable with nonce-based approach for production.
          ...(process.env.NODE_ENV === 'production'
            ? [
                {
                  key: 'Content-Security-Policy',
                  value: [
                    "default-src 'self'",
                    "script-src 'self'",
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
