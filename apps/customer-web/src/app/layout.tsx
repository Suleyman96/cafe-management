import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
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
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
