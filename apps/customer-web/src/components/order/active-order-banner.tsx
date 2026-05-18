'use client';

import { useTranslation } from '@gustri/i18n';
import { ClipboardList } from 'lucide-react';
import Link from 'next/link';
import type { OrderEta } from '@/hooks/use-order-eta';

interface ActiveOrderBannerProps {
  /** Display order number (e.g. "A123"). */
  orderNumber: string;
  /** Target href — tapping the banner navigates to the live order page. */
  href: string;
  /** Optional ETA from `useOrderEta`. Hidden gracefully when null. */
  eta?: OrderEta | null;
}

/**
 * M5 — surfaced on the cart and menu screens when the customer already
 * has an in-flight order on this table. Tells them their next "Place
 * Order" tap will append to the existing order, not create a duplicate.
 *
 * Tap-target is the whole banner (Link wraps it) so a customer with
 * shaky hands can hit anywhere. The "→ Track" CTA is illustrative only;
 * keyboard focus / screen readers see the banner as a single link.
 */
export function ActiveOrderBanner({ orderNumber, href, eta }: ActiveOrderBannerProps) {
  const { t } = useTranslation('customer');

  return (
    <Link
      href={href}
      data-testid="active-order-banner"
      aria-label={t('cart.addingToOrderAria', { orderNumber })}
      className="block rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-2.5 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <ClipboardList className="h-4 w-4 text-blue-700 dark:text-blue-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 truncate">
            {t('cart.addingToOrder', { orderNumber })}
          </p>
          {eta ? (
            <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 truncate">
              {eta.almostReady
                ? t('orderStatus.eta.almostReady')
                : t('orderStatus.eta.preparing', { minutes: eta.minutes })}
            </p>
          ) : (
            <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 truncate">
              {t('cart.viewActiveOrder')}
            </p>
          )}
        </div>
        <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 rtl:rotate-180">
          →
        </span>
      </div>
    </Link>
  );
}
