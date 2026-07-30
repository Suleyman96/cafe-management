'use client';

import { LANGUAGES, useTranslation } from '@gustri/i18n';
import { QUERY_KEYS } from '@gustri/queries';
import { LoadingSpinner } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle,
  ChefHat,
  ChevronDown,
  ClipboardList,
  Clock,
  Globe,
  Loader2,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useOrder } from '@/hooks/use-order';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { setTableContext } from '@/lib/supabase';
import { writeTableToken } from '@/lib/table-token-storage';
import { useLanguageStore } from '@/store/language-store';
import { HeroHeader } from './hero-header';
import { LanguagePickerSheet } from './language-picker-sheet';
import { SocialLinksSection } from './social-links-section';

// H4 — escalate after this many consecutive non-sentinel failures. Below
// this, retries are silent except for the CTA. At this threshold the
// banner switches to a stronger "your network looks unstable" copy so
// the customer knows further taps probably won't fix it.
const MAX_TABLE_CONTEXT_RETRIES = 3;

interface TableLandingProps {
  tableId: string;
  token?: string;
}

export function TableLanding({ tableId, token }: TableLandingProps) {
  const router = useRouter();
  const { t } = useTranslation('customer');
  const { data: table, isLoading, error } = useTable(tableId);
  const { language, setLanguage } = useLanguageStore();
  const { data: settings } = useCafeSettings();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [tenantPlan, setTenantPlan] = useState<string | null>(null);
  const formatPrice = useFormatPrice();
  // The three QR-failure sentinels look identical at the UI layer
  // (`invalid_qr_token` / `qr_token_expired` / `qr_token_revoked`).
  // Collapse them into a single "QR is no longer valid" UI since the
  // customer's required action is identical: ask staff for a fresh
  // code. Differentiating the three would burn 3 × 20 locale entries
  // for negligible UX gain.
  const [qrTokenError, setQrTokenError] = useState(false);
  // H4 — non-sentinel `set_table_context` failures (transient RPC
  // blips) used to land in Sentry silently while `tenantPlan` stayed
  // null and the Browse Menu area rendered an empty 48px placeholder.
  // Surface a "Couldn't load — tap to retry" CTA instead; escalate
  // copy after MAX_TABLE_CONTEXT_RETRIES failed attempts so a
  // hard-broken connection doesn't trick the customer into infinite
  // taps.
  const [retryNeeded, setRetryNeeded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryPending, setRetryPending] = useState(false);

  const actualTableId = table?.id || '';
  const queryClient = useQueryClient();
  const { data: activeOrder, isLoading: orderLoading } = useOrder(actualTableId);

  // Persist the scanned QR token per-table so sub-pages (menu/cart/order),
  // which don't carry `?token=…`, can present it to `get_active_order_for_table`
  // (the RPC now requires it — migration 20260727000001). The first `useOrder`
  // fetch may run before the token is stored (returning null), so invalidate
  // the order query once the capability is available.
  useEffect(() => {
    if (actualTableId && token) {
      writeTableToken(actualTableId, token);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDER, actualTableId] });
    }
  }, [actualTableId, token, queryClient]);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  const resolveTableContext = useCallback(async (qrToken: string) => {
    setRetryPending(true);
    try {
      const plan = await setTableContext(qrToken);
      if (plan) setTenantPlan(plan);
      // H4 — if `set_table_context` returns no plan, fall back to
      // letting the customer browse with the default `standard`
      // tier rather than rendering an empty 48px gap. Capture to
      // Sentry so the contract change doesn't go unnoticed; the
      // RPC's contract is "tenant_id + plan" since migration
      // 20260515000003.
      if (!plan) {
        Sentry.captureMessage('set_table_context returned no plan; falling back to menu CTA', {
          level: 'warning',
          tags: { surface: 'table-landing.plan-fallback' },
        });
        setTenantPlan('standard');
      }
      setRetryNeeded(false);
      setRetryCount(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message === 'invalid_qr_token' ||
        message === 'qr_token_expired' ||
        message === 'qr_token_revoked'
      ) {
        // Policy failures — different UI surface, no retry path.
        setQrTokenError(true);
      } else {
        // Network jitter / transient RPC failure. Show the retry
        // CTA and let the customer drive recovery. The Sentry
        // capture stays so we still see real outages.
        Sentry.captureException(err);
        setRetryNeeded(true);
        setRetryCount((n) => n + 1);
      }
    } finally {
      setRetryPending(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      // Fire-and-forget; resolveTableContext owns its own state.
      void resolveTableContext(token);
    }
  }, [token, resolveTableContext]);

  if (isLoading || orderLoading) {
    return <LoadingSpinner fullScreen />;
  }

  const getOrderStatusInfo = (status: string) => {
    switch (status) {
      case 'new':
        return { label: t('table.status.orderPlaced'), icon: ClipboardList, color: 'bg-blue-500' };
      case 'preparing':
        return { label: t('table.status.preparing'), icon: ChefHat, color: 'bg-amber-500' };
      case 'ready':
        return {
          label: t('table.status.readyToServe'),
          icon: CheckCircle,
          color: 'bg-emerald-500',
        };
      case 'served':
        return { label: t('table.status.served'), icon: CheckCircle, color: 'bg-emerald-600' };
      default:
        return { label: status, icon: Clock, color: 'bg-gray-500' };
    }
  };

  if (error || !table || qrTokenError) {
    return (
      <div className="flex h-[100svh] flex-col items-center justify-center bg-[#0a0a0a] p-4">
        <h1 className="text-2xl font-bold text-red-400">{t('table.invalidTitle')}</h1>
        <p className="mt-2 text-neutral-400">{t('table.invalidDescription')}</p>
      </div>
    );
  }

  const hasSocialLinks =
    settings?.social_instagram ||
    settings?.social_whatsapp ||
    settings?.social_tiktok ||
    settings?.social_telegram ||
    settings?.social_line ||
    settings?.contact_website ||
    settings?.location_maps_url;

  const accentColor = settings?.brand_primary_color || '#C8A97E';

  return (
    <div className="flex min-h-[100svh] flex-col bg-[#0C0C0E]">
      {/* ===== HERO ===== */}
      <HeroHeader settings={settings} accentColor={accentColor} />

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex flex-1 flex-col px-5 -mt-12 relative z-10 pb-6">
        <div className="mx-auto w-full max-w-sm flex flex-col flex-1">
          {/* Table Card — glassmorphism */}
          <div
            className="rounded-2xl p-4 mb-4 backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${accentColor}bb)`,
                  color: '#0C0C0E',
                }}
              >
                {String(table.table_number).replace(/\D/g, '') || '#'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{table.table_number}</p>
                <p className="text-xs text-white/55">
                  {t('table.yourTable')}
                  {table.capacity ? ` · ${t('table.capacity', { count: table.capacity })}` : ''}
                </p>
              </div>
              {table.location && (
                <div className="flex items-center gap-1 text-xs text-white/55 shrink-0">
                  <MapPin className="h-3 w-3" />
                  <span>{table.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Active Order Banner */}
          {activeOrder && (
            <div
              className="mb-4 cursor-pointer"
              onClick={() => router.push(`/table/${tableId}/order`)}
            >
              <div
                className="relative overflow-hidden rounded-2xl p-4 backdrop-blur-xl transition-all active:scale-[0.98]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {/* Accent line */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[2px]"
                  style={{
                    background: `linear-gradient(180deg, ${accentColor}, ${accentColor}60)`,
                  }}
                />

                <div className="flex items-center justify-between pl-2">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const statusInfo = getOrderStatusInfo(activeOrder.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <>
                          <div className={`p-2 rounded-xl ${statusInfo.color} text-white`}>
                            <StatusIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {t('table.activeOrderTitle')} #{activeOrder.order_number}
                            </p>
                            {/* M7 — drop the `.split('•').pop()` parsing
                                that was reading the count back out of a
                                translation. We have the count, the
                                status, and the total in hand — stitch
                                them with `·` from primitives instead of
                                round-tripping through i18n. */}
                            <p className="text-xs text-white/55">
                              {formatPrice(activeOrder.total)} ·{' '}
                              {activeOrder.order_items?.length || 0} {t('tableLanding.items')} ·{' '}
                              {statusInfo.label}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${accentColor}15` }}
                  >
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" style={{ color: accentColor }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Language selector */}
          <button
            onClick={() => setShowLanguagePicker(true)}
            className="mx-auto mb-4 flex items-center gap-2.5 rounded-full border border-white/15 bg-white/8 backdrop-blur-xl px-5 py-2.5 text-sm text-white/80 transition-all hover:bg-white/15 active:scale-95"
          >
            <Globe className="h-[18px] w-[18px]" />
            <span className="text-lg leading-none">{currentLang.flag}</span>
            <span className="font-semibold tracking-wide">{currentLang.code.toUpperCase()}</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </button>

          {/* Browse Menu CTA */}
          {tenantPlan === null && retryNeeded ? (
            // H4 — show a retryable CTA when set_table_context failed
            // for a non-sentinel reason. After MAX_TABLE_CONTEXT_RETRIES
            // attempts the copy escalates to make it clear further
            // taps probably won't help.
            <button
              type="button"
              onClick={() => token && resolveTableContext(token)}
              disabled={retryPending || !token}
              className="w-full rounded-2xl py-4 px-6 text-center backdrop-blur-xl transition-all active:scale-[0.97] disabled:opacity-60"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span className="flex items-center justify-center gap-2 text-sm font-medium text-white/80">
                {retryPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {retryCount >= MAX_TABLE_CONTEXT_RETRIES
                  ? t('tableLanding.networkUnstable')
                  : t('tableLanding.retryLoad')}
              </span>
            </button>
          ) : tenantPlan === null ? (
            <div className="h-12" />
          ) : tenantPlan === 'free' ? (
            <div
              className="w-full rounded-2xl py-4 px-6 text-center backdrop-blur-xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-sm font-medium text-white/70">
                {t('tableLanding.qrNotAvailable')}
              </p>
              <p className="text-xs text-white/55 mt-1">{t('tableLanding.orderAtCounter')}</p>
            </div>
          ) : (
            <button
              className="group w-full rounded-2xl py-4 px-6 text-base font-semibold transition-all active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                color: '#0C0C0E',
                boxShadow: `0 8px 32px ${accentColor}30, 0 0 0 1px ${accentColor}40`,
              }}
              onClick={() => router.push(`/table/${tableId}/menu`)}
            >
              <span className="flex items-center justify-center gap-2">
                {settings?.qr_ordering_enabled === false
                  ? t('table.viewMenu')
                  : activeOrder
                    ? t('table.addMoreItems')
                    : t('table.browseMenu')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
              </span>
            </button>
          )}

          {/* Social Links */}
          {hasSocialLinks && <SocialLinksSection settings={settings} accentColor={accentColor} />}

          {/* Footer — pushed to bottom */}
          <div className="mt-auto text-center py-4 pt-8">
            <p className="text-xs text-white/55 font-light">
              {t('tableLanding.poweredBy')}{' '}
              <span className="font-medium" style={{ color: `${accentColor}80` }}>
                gustri
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ===== LANGUAGE PICKER BOTTOM SHEET ===== */}
      <LanguagePickerSheet
        open={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        language={language}
        setLanguage={setLanguage}
        accentColor={accentColor}
      />
    </div>
  );
}
