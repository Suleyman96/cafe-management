'use client';

import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import { ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCafeSettings } from '@/hooks/use-settings';
import { useCartStore } from '@/store/cart-store';

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('customer');
  const pathname = usePathname();
  const { data: settings } = useCafeSettings();
  const itemCount = useCartStore((state) => state.getItemCount());

  const showCart = pathname?.includes('/menu') && itemCount > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/delivery" className="flex items-center gap-2">
            {settings?.cafe_logo_url && (
              <Image
                src={settings.cafe_logo_url}
                alt={settings.restaurant_name}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <span className="font-bold text-lg">
              {settings?.restaurant_name || t('delivery.restaurantFallback')}
            </span>
          </Link>
          {showCart && (
            <Link href="/delivery/cart">
              <Button variant="outline" size="sm" className="relative">
                <ShoppingCart className="h-4 w-4 mr-1" />
                {t('delivery.cart')}
                <span className="ml-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                  {itemCount}
                </span>
              </Button>
            </Link>
          )}
        </div>
      </header>

      {children}
    </div>
  );
}
