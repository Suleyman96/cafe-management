'use client';

import { Globe, Instagram, MapPin, MapPinned, Phone } from 'lucide-react';
import type { CafeSettings } from '@/hooks/use-settings';
import {
  ensureUrl,
  getInstagramUrl,
  getLineUrl,
  getPhoneUrl,
  getTelegramUrl,
  getTikTokUrl,
  getWhatsAppUrl,
} from '@/lib/social-url';

interface SocialLinksSectionProps {
  settings: CafeSettings | undefined;
  accentColor: string;
}

export function SocialLinksSection({ settings, accentColor }: SocialLinksSectionProps) {
  return (
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
              className="flex items-center gap-2 text-xs text-white/55 hover:text-white/70 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{settings.contact_phone}</span>
            </a>
          )}
          {settings?.restaurant_address && (
            <a
              href={settings?.location_maps_url ? ensureUrl(settings.location_maps_url) : '#'}
              target={settings?.location_maps_url ? '_blank' : undefined}
              rel={settings?.location_maps_url ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-2 text-xs text-white/55 hover:text-white/70 transition-colors text-center max-w-[280px]"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{settings.restaurant_address}</span>
            </a>
          )}
        </div>
      )}
    </>
  );
}
