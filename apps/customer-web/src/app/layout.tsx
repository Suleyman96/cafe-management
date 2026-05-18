import type { Metadata } from 'next';
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
