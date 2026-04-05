'use client';

import type { Language } from '@gustri/i18n';
import { LANGUAGES, useTranslation } from '@gustri/i18n';
import {
  ArrowRight,
  CheckCircle,
  ChefHat,
  ChevronDown,
  ClipboardList,
  Clock,
  Globe,
  Instagram,
  MapPin,
  MapPinned,
  Phone,
  UtensilsCrossed,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useOrder } from '@/hooks/use-order';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { setTableContext, supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useLanguageStore } from '@/store/language-store';

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

  const actualTableId = table?.id || '';
  const { data: activeOrder, isLoading: orderLoading } = useOrder(actualTableId);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    if (token) {
      setTableContext(token)
        .then(() => {
          // After context is set, check tenant plan for QR ordering gate
          (supabase.rpc as Function)('get_tenant_plan_from_context')
            .then((res: any) => { if (res.data) setTenantPlan(res.data); })
            .catch(console.warn);
        })
        .catch((err: any) => {
          console.error('Failed to set table context:', err);
        });
    }
  }, [token]);

  useEffect(() => {
    if (showLanguagePicker) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showLanguagePicker]);

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

  if (error || !table) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0a0a0a] p-4">
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

  // Normalize social URLs so raw usernames/numbers still work
  const getInstagramUrl = (val: string) => {
    if (val.startsWith('http')) return val;
    const handle = val.replace(/^@/, '');
    return `https://instagram.com/${handle}`;
  };
  const getWhatsAppUrl = (val: string) => {
    if (val.startsWith('http')) return val;
    const digits = val.replace(/[^0-9]/g, '');
    return `https://wa.me/${digits}`;
  };
  const getTikTokUrl = (val: string) => {
    if (val.startsWith('http')) return val;
    const handle = val.startsWith('@') ? val : `@${val}`;
    return `https://tiktok.com/${handle}`;
  };
  const getTelegramUrl = (val: string) => {
    if (val.startsWith('http')) return val;
    const handle = val.replace(/^@/, '');
    return `https://t.me/${handle}`;
  };
  const getLineUrl = (val: string) => {
    if (val.startsWith('http')) return val;
    const handle = val.replace(/^@/, '');
    return `https://line.me/R/ti/p/@${handle}`;
  };
  const getPhoneUrl = (val: string) => {
    return `tel:${val.replace(/[^0-9+]/g, '')}`;
  };
  const ensureUrl = (val: string) => {
    if (val.startsWith('http')) return val;
    return `https://${val}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0C0C0E]">
      {/* ===== HERO ===== */}
      <div className="relative">
        <div className="relative overflow-hidden px-6 pt-12 pb-28">
          {/* Background: hero image or dark gradient */}
          {settings?.hero_image_url ? (
            <>
              <Image
                src={settings.hero_image_url}
                alt=""
                fill
                className="object-cover"
                priority
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#0C0C0E]" />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at 30% 20%, ${accentColor}18 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, ${accentColor}10 0%, transparent 50%), linear-gradient(180deg, #151518 0%, #0C0C0E 100%)`,
              }}
            />
          )}

          {/* Subtle grain overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
            }}
          />

          {/* Hero content */}
          <div className="relative z-[5] flex flex-col items-center text-center">
            {settings?.cafe_logo_url ? (
              <div className="mb-4">
                <div
                  className="h-20 w-20 rounded-2xl p-1 shadow-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
                    border: `1px solid ${accentColor}25`,
                  }}
                >
                  <Image
                    src={settings.cafe_logo_url}
                    alt={settings?.restaurant_name || t('table.restaurantFallback')}
                    width={72}
                    height={72}
                    className="rounded-xl object-contain"
                    unoptimized
                  />
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}25, ${accentColor}10)`,
                    border: `1px solid ${accentColor}20`,
                  }}
                >
                  <UtensilsCrossed className="h-9 w-9" style={{ color: `${accentColor}cc` }} />
                </div>
              </div>
            )}

            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {settings?.restaurant_name || t('table.restaurantFallback')}
            </h1>
            {settings?.welcome_heading && (
              <p className="mt-1.5 text-sm font-light tracking-wide text-white/70">
                {settings.welcome_heading}
              </p>
            )}
            <p className="mt-1 text-xs text-white/50 max-w-[240px] font-light">
              {settings?.welcome_message || t('table.tagline')}
            </p>
          </div>
        </div>

        {/* Fade into content */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0C0C0E] to-transparent" />
      </div>

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
                <p className="text-xs text-white/40">
                  {t('table.yourTable')}
                  {table.capacity ? ` · ${t('table.capacity', { count: table.capacity })}` : ''}
                </p>
              </div>
              {table.location && (
                <div className="flex items-center gap-1 text-xs text-white/30 shrink-0">
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
                            <p className="text-xs text-white/40">
                              {statusInfo.label} · {activeOrder.order_items?.length || 0}{' '}
                              {t('table.activeOrderSubtext', {
                                status: statusInfo.label,
                                count: activeOrder.order_items?.length || 0,
                              })
                                .split('•')
                                .pop()
                                ?.trim() || 'items'}
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
                    <ArrowRight className="h-4 w-4" style={{ color: accentColor }} />
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
          {tenantPlan === 'free' ? (
            <div
              className="w-full rounded-2xl py-4 px-6 text-center backdrop-blur-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-sm font-medium text-white/70">
                QR ordering is not available.
              </p>
              <p className="text-xs text-white/40 mt-1">
                Please order at the counter.
              </p>
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
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          )}

          {/* Social Links */}
          {hasSocialLinks && (
            <>
              <div
                className="mx-auto my-5 w-16 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)`,
                }}
              />
              <div className="flex justify-center gap-3">
                {settings?.social_instagram && (
                  <a
                    href={getInstagramUrl(settings.social_instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {settings?.social_tiktok && (
                  <a
                    href={getTikTokUrl(settings.social_tiktok)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.16z" />
                    </svg>
                  </a>
                )}
                {settings?.social_whatsapp && (
                  <a
                    href={getWhatsAppUrl(settings.social_whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                )}
                {settings?.social_telegram && (
                  <a
                    href={getTelegramUrl(settings.social_telegram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                  </a>
                )}
                {settings?.social_line && (
                  <a
                    href={getLineUrl(settings.social_line)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                    </svg>
                  </a>
                )}
                {settings?.contact_website && (
                  <a
                    href={ensureUrl(settings.contact_website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <Globe className="h-5 w-5" />
                  </a>
                )}
                {settings?.location_maps_url && (
                  <a
                    href={ensureUrl(settings.location_maps_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <MapPinned className="h-5 w-5" />
                  </a>
                )}
              </div>

              {/* Phone & Address info */}
              {(settings?.contact_phone || settings?.restaurant_address) && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  {settings?.contact_phone && (
                    <a
                      href={getPhoneUrl(settings.contact_phone)}
                      className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>{settings.contact_phone}</span>
                    </a>
                  )}
                  {settings?.restaurant_address && (
                    <a
                      href={
                        settings?.location_maps_url ? ensureUrl(settings.location_maps_url) : '#'
                      }
                      target={settings?.location_maps_url ? '_blank' : undefined}
                      rel={settings?.location_maps_url ? 'noopener noreferrer' : undefined}
                      className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors text-center max-w-[280px]"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>{settings.restaurant_address}</span>
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          {/* Footer — pushed to bottom */}
          <div className="mt-auto text-center py-4 pt-8">
            <p className="text-xs text-white/20 font-light">
              Powered by{' '}
              <span className="font-medium" style={{ color: `${accentColor}80` }}>
                Gustri
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ===== LANGUAGE PICKER BOTTOM SHEET ===== */}
      {showLanguagePicker && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowLanguagePicker(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-300">
            <div
              className="rounded-t-3xl px-5 pb-8 pt-3 shadow-2xl"
              style={{
                background: 'linear-gradient(180deg, #1A1A1E, #141416)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

              <div className="grid grid-cols-4 gap-1.5 max-h-[50vh] overflow-y-auto scrollbar-hide">
                {LANGUAGES.map((lang) => {
                  const isSelected = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code as Language);
                        setShowLanguagePicker(false);
                      }}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-2xl py-3 px-2 text-center transition-all active:scale-95',
                        isSelected ? '' : 'hover:bg-white/5',
                      )}
                      style={
                        isSelected
                          ? {
                              backgroundColor: `${accentColor}15`,
                              boxShadow: `inset 0 0 0 1.5px ${accentColor}60`,
                            }
                          : {}
                      }
                    >
                      <span className="text-[22px] leading-none">{lang.flag}</span>
                      <span
                        className={cn(
                          'text-[10px] leading-tight font-medium',
                          isSelected ? '' : 'text-white/40',
                        )}
                        style={isSelected ? { color: accentColor } : {}}
                      >
                        {lang.code.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
