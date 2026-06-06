import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { OrderConfirmationOverlay } from '@/components/order/order-confirmation-overlay';
import { Providers } from '@/components/providers';
import { HtmlLangSetter } from '@/components/ui/html-lang-setter';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'gustri - Order',
  description: 'In-store ordering system',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico' },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'gustri',
  },
};

// Next 14 split `viewport`/`themeColor` out of `metadata` into a dedicated
// export. Without it the customer app had no `viewport-fit=cover`, so the
// `100svh` / `fixed inset-0` bottom sheets didn't extend under the notch /
// home-indicator safe areas on iOS, and the PWA `theme_color` from
// `manifest.json` wasn't mirrored as a `theme-color` meta (browser chrome
// stayed default instead of the brand teal). `themeColor` here matches
// `public/manifest.json`.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#367B8B',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <HtmlLangSetter />
          {children}
          {/* M1 — mounted at the root so it survives the route push the
              Track Order tap triggers; the overlay outlives the
              cart-screen unmount. */}
          <OrderConfirmationOverlay />
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
