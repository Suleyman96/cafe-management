'use client';

import { I18nextProvider, i18n } from '@cafe-idare/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import '@/lib/i18n';
import { loadAndSwitchLanguage } from '@/lib/i18n';
import { useLanguageStore } from '@/store/language-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const { language } = useLanguageStore();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    if (i18n.language !== language) {
      loadAndSwitchLanguage(language);
    }
  }, [language]);

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </I18nextProvider>
  );
}
