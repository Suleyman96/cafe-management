import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import { Providers } from './providers';

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
        <Providers>{children}</Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
