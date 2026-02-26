'use client';

import type { Language } from '@cafe-idare/i18n';
import { LANGUAGES, useTranslation } from '@cafe-idare/i18n';
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
  MessageCircle,
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
import { setTableContext } from '@/lib/supabase';
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

  const actualTableId = table?.id || '';
  const { data: activeOrder, isLoading: orderLoading } = useOrder(actualTableId);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    if (token) {
      setTableContext(token);
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
    settings?.contact_phone ||
    settings?.contact_website ||
    settings?.location_maps_url;

  const accentColor = settings?.brand_primary_color || '#C8A97E';

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
            <p className="mt-1.5 text-sm font-light tracking-wide text-white/70">
              {settings?.welcome_heading || t('table.welcomeFallback')}
            </p>
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
                    href={settings.social_instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {settings?.social_whatsapp && (
                  <a
                    href={settings.social_whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </a>
                )}
                {settings?.contact_phone && (
                  <a
                    href={`tel:${settings.contact_phone}`}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <Phone className="h-5 w-5" />
                  </a>
                )}
                {settings?.contact_website && (
                  <a
                    href={settings.contact_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <Globe className="h-5 w-5" />
                  </a>
                )}
                {settings?.location_maps_url && (
                  <a
                    href={settings.location_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white/50 transition-all hover:text-white/80 hover:bg-white/15"
                  >
                    <MapPinned className="h-5 w-5" />
                  </a>
                )}
              </div>
            </>
          )}

          {/* Footer — pushed to bottom */}
          <div className="mt-auto text-center py-4 pt-8">
            <p className="text-xs text-white/20 font-light">
              Powered by{' '}
              <span className="font-medium" style={{ color: `${accentColor}80` }}>
                Cafe-Man
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
