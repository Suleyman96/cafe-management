'use client';

import { ProgressProvider } from '@bprogress/next/app';
import { isAppError } from '@gustri/core';
import type { Language } from '@gustri/i18n';
import { I18nextProvider, i18n, localizeErrorMessage } from '@gustri/i18n';
import { DbProvider } from '@gustri/queries';
import * as Sentry from '@sentry/nextjs';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import '@/lib/i18n';
import { useCafeSettings } from '@/hooks/use-settings';
import { loadAndSwitchLanguage } from '@/lib/i18n';
import { bindCustomerTenantContext, db } from '@/lib/supabase';
import { useLanguageStore } from '@/store/language-store';

/**
 * S4 — explicit tenant reset on routes that have no tenant of their own.
 *
 * React effect-cleanup is not synchronous with the next route's mount, so
 * navigating `/table/T01/menu` → `/delivery` can briefly leave the
 * wrapper's tenant pinned to the prior table's tenant while
 * `/delivery`'s first reads fire (the delivery landing has no tenant
 * binding until the customer picks `Browse Menu` and `useDeliveryContext`
 * resolves the QR token). In single-tenant deployments this is invisible;
 * in multi-tenant deployments it's a stale-bind risk.
 *
 * This effect runs on every route change and nulls the tenant when the
 * pathname is one we know has no tenant binding of its own. Inner
 * tenant-bound layouts (the table layout, the delivery context hook)
 * re-bind on their own mount, and `bindCustomerTenantContext` skips the
 * Sentry breadcrumb when the bind is a no-op so we don't spam telemetry.
 *
 * Stronger fix — keying tenant into the React Query queryKey so cached
 * data doesn't leak across rebinds — lives on Phase 1 C6.
 */
function TenantContextResetter() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    // `/` (scan-the-QR landing) and `/delivery` exact (pre-token form)
    // are the only routes that should observably run with `tenantId =
    // null`. Anything under `/table/...` or deeper `/delivery/...`
    // rebinds via its own surface, so leave those alone — nulling here
    // would create a brief window where wrapper reads run unscoped.
    if (pathname === '/' || pathname === '/delivery') {
      bindCustomerTenantContext(null, 'route-reset');
    }
  }, [pathname]);
  return null;
}

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
            // H2 — `'always'` (not just `true`) forces a refetch on
            // network reconnect even when the query is still
            // `fresh` per staleTime. Realtime hooks are 10s-stale,
            // so a 60s default window is more than enough time for
            // the customer to lose connection silently; pair this
            // with the per-hook visibility listener for the
            // tab-resume path.
            refetchOnReconnect: 'always',
            retry: 1,
            // P1 — explicit `true` locks in TanStack Query's default
            // structural-sharing behavior so unchanged refetches
            // preserve array+object references end-to-end. The menu
            // screen's `localizedItems` memo depends on
            // `[menuItems, language]`; if a future upgrade or
            // upstream change flipped this off, every refetch on a
            // 200-item menu would re-run the localization pass on
            // cheap Android phones for no semantic gain. Cheap to
            // set explicitly; expensive to debug if it regresses.
            structuralSharing: true,
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
      <ProgressProvider
        height="3px"
        color="#367B8B"
        options={{ showSpinner: false }}
        shallowRouting
      >
        <QueryClientProvider client={queryClient}>
          <DbProvider db={db}>
            <LanguageSync />
            <TenantContextResetter />
            {children}
          </DbProvider>
        </QueryClientProvider>
      </ProgressProvider>
    </I18nextProvider>
  );
}
