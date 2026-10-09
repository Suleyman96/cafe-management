const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
          // Next.js stamps onto its inline hydration `<script>` blocks (and
          // that our JSON-LD reads via `x-nonce`). A static CSP here would
          // override the middleware header and, now that `script-src` no
          // longer allows `'unsafe-inline'`, break hydration with
          // "Executing inline script violates the following Content Security
          // Policy". See the middleware for the full rationale (M8).
        ],
      },
    ];
  },
};

// Sentry build plugin: uploads source maps (when SENTRY_ORG/PROJECT/auth token
// are set in CI) and auto-wires the server/edge/client configs. No-ops at
// runtime until NEXT_PUBLIC_SENTRY_DSN is set, so this is safe to ship ahead of
// provisioning the Sentry project.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: { treeshake: { removeDebugLogging: true } },
});
