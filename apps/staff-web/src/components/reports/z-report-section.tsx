'use client';

import { useTranslation } from '@gustri/i18n';
import { Banknote, CreditCard, Receipt, Smartphone, TrendingUp } from 'lucide-react';

interface ZReportData {
  cashTotal: number;
  cardTotal: number;
  digitalTotal: number;
  tipsCollected: number;
  paymentCount: number;
  totalDiscounts: number;
}

interface ZReportSectionProps {
  data: ZReportData;
  formatPrice: (amount: number) => string;
}

// A payments-by-method summary for the period. Cash-drawer reconciliation
// (expected vs counted, net of refunds) is intentionally NOT here — it lives on
// the dedicated /reports/shift-reconciliation page, which is the single source
// of truth and correctly nets refunds. Duplicating a refund-blind variance
// calc here was both redundant and wrong. Discounts likewise show once, in the
// Profit & Loss section.
export function ZReportSection({ data, formatPrice }: ZReportSectionProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-8">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
        <h2 className="text-base sm:text-lg font-semibold">{t('reports.zReport')}</h2>
      </div>

      {/* Payment Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <div className="bg-green-50 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-green-700">{t('reports.cashPayments')}</p>
            <Banknote className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-green-700">
            {formatPrice(data.cashTotal)}
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-blue-700">{t('reports.cardPayments')}</p>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-blue-700">
            {formatPrice(data.cardTotal)}
          </p>
        </div>

        <div className="bg-purple-50 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-purple-700">{t('reports.digitalPayments')}</p>
            <Smartphone className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-purple-700">
            {formatPrice(data.digitalTotal)}
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 rounded-lg p-3 sm:p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs sm:text-sm text-amber-700">{t('reports.tipsCollected')}</p>
          <TrendingUp className="h-4 w-4 text-amber-600" />
        </div>
        <p className="text-lg sm:text-2xl font-bold text-amber-700">
          {formatPrice(data.tipsCollected)}
        </p>
      </div>
    </div>
  );
}
