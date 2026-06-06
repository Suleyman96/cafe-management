'use client';

import { useTranslation } from '@gustri/i18n';
import { UtensilsCrossed } from 'lucide-react';
import Image from 'next/image';
import type { CafeSettings } from '@/hooks/use-settings';

interface HeroHeaderProps {
  settings: CafeSettings | undefined;
  accentColor: string;
}

export function HeroHeader({ settings, accentColor }: HeroHeaderProps) {
  const { t } = useTranslation('customer');

  return (
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
              sizes="100vw"
            />
            {/* A8 — customer-uploaded hero images vary wildly in
                brightness (e.g. sunlit dishes). Stronger gradient +
                uniform dark wash ensures the welcome copy clears
                WCAG AA contrast across the range without sacrificing
                too much imagery on already-dark photos. */}
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/65 to-[#0C0C0E]" />
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
          <p className="mt-1 text-xs text-white/55 max-w-[240px] font-light">
            {settings?.welcome_message || t('table.tagline')}
          </p>
        </div>
      </div>

      {/* Fade into content */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0C0C0E] to-transparent" />
    </div>
  );
}
