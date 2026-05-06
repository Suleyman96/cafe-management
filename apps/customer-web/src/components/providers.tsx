'use client';

import { isAppError } from '@gustri/core';
import type { Language } from '@gustri/i18n';
import { I18nextProvider, i18n, localizeErrorMessage } from '@gustri/i18n';
import { DbProvider } from '@gustri/queries';
import * as Sentry from '@sentry/nextjs';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
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
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.options.onError) return;
            Sentry.captureException(error);
            const fallback = i18n.t('somethingWentWrong', {
              ns: 'common',
              defaultValue: 'An unexpected error occurred',
            });
            toast.error(
              isAppError(error) ? localizeErrorMessage(error.message, fallback) : fallback,
            );
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: true,
            retry: 1,
          },
          // Money mutations (delivery order create + add items) must never
          // auto-retry. Retries are user-driven and reuse a stable
          // `client_request_id` so the server dedupes via its
          // (tenant_id, client_request_id) unique indexes. `networkMode`
          // pinned to 'online' so an upstream change can't switch to
          // 'always' and queue a write against a stale token.
          mutations: {
            retry: 0,
            networkMode: 'online',
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
