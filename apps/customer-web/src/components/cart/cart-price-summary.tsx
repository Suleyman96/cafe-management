'use client';

import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';

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
  formatPrice: (amount: number) => string;
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
  formatPrice,
}: CartPriceSummaryProps) {
  const { t } = useTranslation('customer');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4">
      <div className="space-y-2 mb-4">
        {deliveryFee != null && deliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('deliveryFee', { ns: 'common' })}</span>
            <span>{formatPrice(deliveryFee)}</span>
          </div>
        )}
        <div
          className={`flex justify-between text-lg font-bold ${deliveryFee != null && deliveryFee > 0 ? 'pt-2 border-t' : ''}`}
        >
          <span>{t('total', { ns: 'common' })}</span>
          <span className="text-primary">{formatPrice(total)}</span>
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
          <p className="text-sm text-amber-700 dark:text-amber-300 text-center">{minimumWarning}</p>
        </div>
      )}

      <Button
        size="xl"
        className="w-full"
        onClick={onPlaceOrder}
        disabled={isLoading || !minimumMet}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            {t('placingOrder', { ns: 'common' })}
          </>
        ) : !minimumMet ? (
          t('minimumOrderNotMet', { ns: 'common' })
        ) : (
          placeOrderLabel
        )}
      </Button>
    </div>
  );
}
