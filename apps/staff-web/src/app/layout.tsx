import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';
import { HtmlLangSetter } from '@/components/ui/html-lang-setter';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'gustri | Staff Portal',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <Providers>
          <HtmlLangSetter />
          {children}
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
