import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { ChunkErrorRecovery } from '@/components/pwa/chunk-error-recovery';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import { Providers } from './providers';

// Opt the whole app into dynamic rendering so Next.js stamps the per-request
// CSP nonce (minted in `middleware.ts`) onto its inline bootstrap <script>
// tags. A statically prerendered tree has no nonce baked in, so the strict
// `script-src 'self' 'nonce-…' 'strict-dynamic'` policy blocks those scripts
// and React never hydrates — the failure that reverted the first CSP attempt
// (the login Sign-in button stayed disabled because onChange never fired).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'gustri | Restaurant Management System',
  description: 'Restaurant management system by gustri',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'gustri',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#367B8B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading a request header is Next.js's documented opt-in for stamping the
  // per-request CSP nonce onto the inline bootstrap scripts. Combined with the
  // `force-dynamic` export above, this guarantees every route is rendered at
  // request time with the nonce applied — so the strict CSP never blocks
  // hydration. The value itself isn't needed (Next applies the nonce
  // internally from the request CSP header); the call is the trigger.
  headers();

  return (
    <html lang="en">
      <head>
        {/* Warm up the TCP+TLS handshake to Supabase in parallel with HTML
            parsing. On distant clients (e.g. Baku → Supabase Tokyo) the
            first REST/Realtime call would otherwise pay ~500ms for the
            cold connection setup; preconnecting in <head> overlaps it
            with the document download. Effectively free in regions that
            already have low RTT to Supabase. */}
        <link
          rel="preconnect"
          href={process.env.NEXT_PUBLIC_SUPABASE_URL}
          crossOrigin="anonymous"
        />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ChunkErrorRecovery />
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
