'use client';

import type { Language } from '@gustri/i18n';
import { I18nextProvider, i18n } from '@gustri/i18n';
import { DbProvider } from '@gustri/queries';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import '@/lib/i18n';
import { useCafeSettings } from '@/hooks/use-settings';
import { loadAndSwitchLanguage } from '@/lib/i18n';
import { db } from '@/lib/supabase';
import { useLanguageStore } from '@/store/language-store';

function LanguageSync() {
  const { language, hasUserChosenLanguage } = useLanguageStore();
  const { data: settings, isPlaceholderData } = useCafeSettings();
  const appliedDefault = useRef(false);

  // Apply cafe's default language for first-time visitors (once real settings load)
  useEffect(() => {
    if (appliedDefault.current || hasUserChosenLanguage || isPlaceholderData) return;

    const defaultLang = settings?.default_language as Language | undefined;
    if (defaultLang) {
      appliedDefault.current = true;
      if (defaultLang !== language) {
        useLanguageStore.setState({ language: defaultLang });
        loadAndSwitchLanguage(defaultLang);
        return;
      }
    }
  }, [hasUserChosenLanguage, isPlaceholderData, settings?.default_language, language]);

  // Keep i18n in sync with store language
  useEffect(() => {
    if (i18n.language !== language) {
      loadAndSwitchLanguage(language);
    }
  }, [language]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
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

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <DbProvider db={db}>
          <LanguageSync />
          {children}
        </DbProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
