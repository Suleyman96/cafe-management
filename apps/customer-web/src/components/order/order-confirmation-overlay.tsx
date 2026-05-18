'use client';

import { useTranslation } from '@gustri/i18n';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useOrderConfirmationStore } from '@/store/order-confirmation-store';

/**
 * M1 — full-screen confirmation overlay shown immediately after a
 * successful order submit. Replaces the "auto-dismissed toast + slow
 * route push" gap that left customers staring at nothing on flaky
 * connections.
 *
 * The Track Order button drives the navigation; a fallback timer
 * auto-navigates after `AUTO_DISMISS_MS` so a customer who looks away
 * still lands on the right screen. The overlay sits at the root so it
 * survives the route transition the navigation triggers.
 *
 * Y5 — auto-dismiss bumped from 8 s to 15 s. On slow 3G the overlay can
 * take 5+ s to render fully, which left customers ~3 s to read the
 * order number under the old timing. 15 s leaves comfortable reading
 * room without making the overlay feel stuck.
 */
const AUTO_DISMISS_MS = 15_000;

export function OrderConfirmationOverlay() {
  const { t } = useTranslation('customer');
  const router = useRouter();
  const formatPrice = useFormatPrice();
  const pending = useOrderConfirmationStore((s) => s.pending);
  const dismiss = useOrderConfirmationStore((s) => s.dismiss);

  // Auto-dismiss fallback. Cleared if the overlay is unmounted or the
  // pending state is cleared explicitly — Track Order tap drives
  // navigation and clears the state itself.
  useEffect(() => {
    if (!pending) return;
    const id = setTimeout(() => {
      router.push(pending.trackHref);
      dismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [pending, router, dismiss]);

  if (!pending) return null;

  const handleTrack = () => {
    router.push(pending.trackHref);
    dismiss();
  };

  const subtitleKey =
    pending.flow === 'delivery'
      ? 'orderConfirmation.subtitleDelivery'
      : 'orderConfirmation.subtitleDineIn';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{
        background: 'linear-gradient(180deg, rgba(12,12,14,0.98), rgba(12,12,14,1))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-confirmation-title"
    >
      <div className="w-full max-w-sm text-center">
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
          style={{
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.3)',
          }}
        >
          <CheckCircle2 className="h-10 w-10 text-green-400" />
        </div>

        <h2 id="order-confirmation-title" className="text-2xl font-semibold text-white mb-2">
          {t('orderConfirmation.title')}
        </h2>
        <p className="text-sm text-white/60 mb-8">{t(subtitleKey)}</p>

        <div
          className="rounded-2xl p-5 mb-8 text-left"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-white/55">
              {t('orderConfirmation.orderNumber')}
            </span>
            <span className="text-base font-bold text-white">#{pending.orderNumber}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-white/55">
              {t('orderConfirmation.items')}
            </span>
            <span className="text-sm font-medium text-white">{pending.itemCount}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-xs uppercase tracking-wider text-white/55">
              {t('orderConfirmation.total')}
            </span>
            <span className="text-lg font-bold text-white">{formatPrice(pending.total)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTrack}
          className="w-full rounded-2xl py-4 px-6 text-base font-semibold text-white transition-all active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, rgb(34,197,94), rgb(22,163,74))',
            boxShadow: '0 8px 32px rgba(34,197,94,0.25)',
          }}
        >
          <span className="inline-flex items-center justify-center gap-2">
            {t('orderConfirmation.track')}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </span>
        </button>
      </div>
    </div>
  );
}
