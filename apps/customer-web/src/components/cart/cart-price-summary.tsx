'use client';

import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import { Price } from '@/components/ui/price';
import { useFormatPrice } from '@/hooks/use-format-price';

interface CartPriceSummaryProps {
  total: number;
  taxPercentage?: number;
  deliveryFee?: number;
  minimumAmount?: number;
  minimumMet: boolean;
  minimumWarning?: string;
  isLoading: boolean;
  onPlaceOrder: () => void;
  placeOrderLabel: string;
  // H4 — sibling tab already submitted this partition; disable + banner.
  submittedByOtherTab?: boolean;
}

export function CartPriceSummary({
  total,
  taxPercentage,
  deliveryFee,
  minimumAmount,
  minimumMet,
  minimumWarning,
  isLoading,
  onPlaceOrder,
  placeOrderLabel,
  submittedByOtherTab,
}: CartPriceSummaryProps) {
  const { t } = useTranslation('customer');
  const formatPrice = useFormatPrice();

  return (
    // Y4 — `pb-[max(...)]` reserves space for the iOS home indicator so
    // the Place Order button isn't interceptable by the swipe-up gesture
    // on iPhone 14+ / landscape. `max-w-2xl mx-auto` keeps the footer
    // visually anchored to the page content on tablets / desktop where
    // a full-width fixed bar feels detached.
    <div
      className="fixed bottom-0 left-0 right-0 bg-card border-t px-4 pt-4"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-w-2xl">
        <div className="space-y-2 mb-4">
          {deliveryFee != null && deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('deliveryFee', { ns: 'common' })}</span>
              <Price amount={deliveryFee} />
            </div>
          )}
          <div
            className={`flex justify-between text-lg font-bold ${deliveryFee != null && deliveryFee > 0 ? 'pt-2 border-t' : ''}`}
          >
            <span>{t('total', { ns: 'common' })}</span>
            {/* P4 — top-line total is the most visible flicker target; the
              Price component swaps to a skeleton while settings are
              placeholder so the customer never sees `$5` → `₺250` on a
              slow network. */}
            <Price
              amount={total}
              className="text-primary"
              skeletonClassName="h-5 w-20 bg-gray-200/40"
            />
          </div>
          {taxPercentage != null && taxPercentage > 0 && (
            <p className="text-[10px] text-muted-foreground/60 text-right">
              {t('menu.inclTax', { percent: String(taxPercentage) })}
            </p>
          )}
        </div>

        {/* Minimum Order Warning */}
        {minimumAmount && !minimumMet && minimumWarning && (
          <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-700 dark:text-amber-300 text-center">
              {minimumWarning}
            </p>
          </div>
        )}

        {/* H4 — sibling tab already submitted this same cart partition;
          the dedup index would reject a second tap. Tell the customer
          so they don't see a generic error toast and re-tap further. */}
        {submittedByOtherTab && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
              {t('cart.submittedInOtherTab')}
            </p>
          </div>
        )}

        <Button
          data-testid="place-order"
          size="xl"
          className="w-full"
          onClick={onPlaceOrder}
          disabled={isLoading || !minimumMet || !!submittedByOtherTab}
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              {/* CV3 — keep the price in the label mid-mutation so the
                  customer never sees the highest-stakes button drop the
                  number they just committed to. */}
              {t('cart.placingOrderWithPrice', { price: formatPrice(total) })}
            </>
          ) : !minimumMet ? (
            t('minimumOrderNotMet', { ns: 'common' })
          ) : submittedByOtherTab ? (
            t('cart.alreadySubmittedButton')
          ) : (
            placeOrderLabel
          )}
        </Button>
      </div>
    </div>
  );
}
