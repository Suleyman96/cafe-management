const { withSentryConfig } = require('@sentry/nextjs');
const fs = require('node:fs');
const path = require('node:path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Build identifier — set by Vercel; falls back to 'dev' for local builds.
// Exposed to the client via NEXT_PUBLIC_BUILD_SHA so the running tab can
// compare against /api/v1/health and detect a deploy that landed while
// the user kept the page open. Also pinned as Next's generateBuildId so
// _next asset URLs match the SHA, which lets the service worker scope its
// cache by deploy and purge on activate.
//
// Order of resolution:
//   1. VERCEL_GIT_COMMIT_SHA — set when building on Vercel's git integration.
//   2. GIT_COMMIT_SHA — set by callers that want to override.
//   3. apps/staff-web/.commit-sha — written by .github/workflows/deploy-staff-web.yml
//      because `vercel build` running off Vercel infra sandboxes its env and
//      strips host vars, so a file is the only reliable handoff path.
//   4. 'dev' — local development.
//
// We coerce empty strings to undefined so `||` fallbacks fire correctly:
// `vercel build` running off Vercel infra exports VERCEL_GIT_COMMIT_SHA=""
// rather than leaving it unset, which a bare `??` chain would treat as a
// real value — and a `''` buildId trips Next's runtime invariant on every
// dynamic route ("Invariant: buildID is required").
function readCommitShaFile() {
  try {
    return fs.readFileSync(path.join(__dirname, '.commit-sha'), 'utf8').trim() || undefined;
  } catch {
    return undefined;
  }
}
const COMMIT_SHA =
  (process.env.VERCEL_GIT_COMMIT_SHA || undefined) ??
  (process.env.GIT_COMMIT_SHA || undefined) ??
  readCommitShaFile() ??
  'dev';

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
          // Content-Security-Policy is NOT set here. It is emitted per-request
          // from `src/middleware.ts` with a fresh nonce + 'strict-dynamic'
          // (see `src/lib/security/csp.ts`), which let us drop the
          // 'unsafe-inline' / 'unsafe-eval' a static policy required. A static
          // CSP here would be sent *in addition* to the middleware one, and
          // browsers enforce multiple CSP headers as an intersection — the
          // permissive static policy would not loosen the nonce policy, but
          // keeping a second source of truth invites drift, so there is none.
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
