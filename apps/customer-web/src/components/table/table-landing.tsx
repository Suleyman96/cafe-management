'use client';

import type { Language } from '@cafe-idare/i18n';
import { LANGUAGES, useTranslation } from '@cafe-idare/i18n';
import {
  CheckCircle,
  ChefHat,
  ClipboardList,
  Clock,
  Globe,
  Instagram,
  MapPin,
  MapPinned,
  MessageCircle,
  Phone,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlatformFooter } from '@/components/ui/platform-footer';
import { useOrder } from '@/hooks/use-order';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { setTableContext } from '@/lib/supabase';
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

  // Fetch active order for this table
  const actualTableId = table?.id || '';
  const { data: activeOrder, isLoading: orderLoading } = useOrder(actualTableId);

  useEffect(() => {
    if (token) {
      setTableContext(token);
    }
  }, [token]);

  if (isLoading || orderLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Helper to get order status display info
  const getOrderStatusInfo = (status: string) => {
    switch (status) {
      case 'new':
        return { label: t('table.status.orderPlaced'), icon: ClipboardList, color: 'bg-blue-500' };
      case 'preparing':
        return { label: t('table.status.preparing'), icon: ChefHat, color: 'bg-yellow-500' };
      case 'ready':
        return { label: t('table.status.readyToServe'), icon: CheckCircle, color: 'bg-green-500' };
      case 'served':
        return { label: t('table.status.served'), icon: CheckCircle, color: 'bg-green-600' };
      default:
        return { label: status, icon: Clock, color: 'bg-gray-500' };
    }
  };

  if (error || !table) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-destructive">{t('table.invalidTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('table.invalidDescription')}</p>
      </div>
    );
  }

  // Check if any social links are configured
  const hasSocialLinks =
    settings?.social_instagram ||
    settings?.social_whatsapp ||
    settings?.contact_phone ||
    settings?.contact_website ||
    settings?.location_maps_url;

  // Dynamic styles based on brand colors
  const primaryColor = settings?.brand_primary_color || '#3B82F6';

  return (
    <div
      className="flex min-h-screen flex-col p-6 relative"
      style={{
        background: settings?.hero_image_url
          ? `linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.85)), url(${settings.hero_image_url}) center/cover no-repeat`
          : `linear-gradient(to bottom, ${primaryColor}15, white)`,
      }}
    >
      {/* Social Links Bar */}
      {hasSocialLinks && (
        <div className="flex justify-center gap-3 mb-4">
          {settings?.social_instagram && (
            <a
              href={settings.social_instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/80 shadow-sm hover:shadow-md transition-all hover:scale-110"
              style={{ color: primaryColor }}
            >
              <Instagram className="h-5 w-5" />
            </a>
          )}
          {settings?.social_whatsapp && (
            <a
              href={settings.social_whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/80 shadow-sm hover:shadow-md transition-all hover:scale-110"
              style={{ color: primaryColor }}
            >
              <MessageCircle className="h-5 w-5" />
            </a>
          )}
          {settings?.contact_phone && (
            <a
              href={`tel:${settings.contact_phone}`}
              className="p-2 rounded-full bg-white/80 shadow-sm hover:shadow-md transition-all hover:scale-110"
              style={{ color: primaryColor }}
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
          {settings?.contact_website && (
            <a
              href={settings.contact_website}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/80 shadow-sm hover:shadow-md transition-all hover:scale-110"
              style={{ color: primaryColor }}
            >
              <Globe className="h-5 w-5" />
            </a>
          )}
          {settings?.location_maps_url && (
            <a
              href={settings.location_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/80 shadow-sm hover:shadow-md transition-all hover:scale-110"
              style={{ color: primaryColor }}
            >
              <MapPinned className="h-5 w-5" />
            </a>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full">
        {/* Logo / Branding */}
        <div className="mb-8 text-center">
          {settings?.cafe_logo_url ? (
            <div className="mb-4">
              <Image
                src={settings.cafe_logo_url}
                alt={settings?.restaurant_name || t('table.restaurantFallback')}
                width={120}
                height={120}
                className="mx-auto rounded-2xl shadow-lg object-contain"
              />
            </div>
          ) : null}
          <h1 className="text-3xl font-bold" style={{ color: primaryColor }}>
            {settings?.restaurant_name || t('table.restaurantFallback')}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {settings?.welcome_heading || t('table.welcomeFallback')}
          </p>
          {settings?.welcome_message && (
            <p className="mt-1 text-sm text-muted-foreground/80 max-w-xs mx-auto">
              {settings.welcome_message}
            </p>
          )}
        </div>

        {/* Table Info Card */}
        <div className="w-full bg-card/95 backdrop-blur rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold">{table.table_number}</h2>
              <p className="text-sm text-muted-foreground">{t('table.yourTable')}</p>
            </div>
            <Users className="h-8 w-8" style={{ color: primaryColor }} />
          </div>

          {table.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{table.location}</span>
            </div>
          )}

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {t('table.capacity', { count: table.capacity })}
            </p>
          </div>
        </div>

        {/* Active Order Card */}
        {activeOrder && (
          <div
            className="w-full bg-card/95 backdrop-blur rounded-xl shadow-lg p-4 mb-6 border-2 cursor-pointer hover:shadow-xl transition-shadow"
            style={{ borderColor: primaryColor }}
            onClick={() => router.push(`/table/${tableId}/order`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const statusInfo = getOrderStatusInfo(activeOrder.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <>
                      <div className={`p-2 rounded-full ${statusInfo.color} text-white`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{t('table.activeOrderTitle')}</p>
                        <p className="text-sm text-muted-foreground">
                          {statusInfo.label} • {activeOrder.order_items?.length || 0} items
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <Badge variant="outline" style={{ color: primaryColor, borderColor: primaryColor }}>
                #{activeOrder.order_number}
              </Badge>
            </div>
            <Button
              size="lg"
              className="w-full mt-4"
              style={{ backgroundColor: primaryColor }}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/table/${tableId}/order`);
              }}
            >
              {t('table.viewOrderStatus')}
            </Button>
          </div>
        )}

        {/* Language Selector */}
        <div className="w-full mb-6">
          <p className="text-sm font-medium mb-2 text-center">{t('table.selectLanguage')}</p>
          <div className="grid grid-cols-4 gap-2">
            {LANGUAGES.map((lang) => (
              <Button
                key={lang.code}
                variant={language === lang.code ? 'default' : 'outline'}
                size="sm"
                onClick={() => setLanguage(lang.code as Language)}
                className="font-medium text-xs"
                style={language === lang.code ? { backgroundColor: primaryColor } : {}}
              >
                {lang.flag} {lang.code.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* Browse Menu Button */}
        {settings?.qr_ordering_enabled !== false ? (
          <Button
            size="xl"
            variant={activeOrder ? 'outline' : 'default'}
            className="w-full"
            style={
              activeOrder
                ? { borderColor: primaryColor, color: primaryColor }
                : { backgroundColor: primaryColor }
            }
            onClick={() => router.push(`/table/${tableId}/menu`)}
          >
            {activeOrder ? t('table.addMoreItems') : t('table.browseMenu')}
          </Button>
        ) : (
          <Button
            size="xl"
            className="w-full"
            style={{ backgroundColor: primaryColor }}
            onClick={() => router.push(`/table/${tableId}/menu`)}
          >
            {t('table.viewMenu')}
          </Button>
        )}

        <p className="mt-4 text-sm text-center text-muted-foreground">
          {settings?.qr_ordering_enabled === false
            ? t('table.hintBrowse')
            : activeOrder
              ? t('table.hintAddMore')
              : t('table.hintScanQR')}
        </p>
      </div>

      {/* Powered by Cafe-Man Footer */}
      <PlatformFooter className="mt-auto pt-2" />
    </div>
  );
}
