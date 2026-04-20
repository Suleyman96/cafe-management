'use client';

import { useTranslation } from '@gustri/i18n';
import { NumberInput } from '@gustri/ui';
import { Banknote, CreditCard, Receipt, Smartphone, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';

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

export function ZReportSection({ data, formatPrice }: ZReportSectionProps) {
  const { t } = useTranslation('staff');
  const [actualCash, setActualCash] = useState('');

  const parsedActual = parseFloat(actualCash) || 0;
  const expectedCash = data.cashTotal;
  const variance = parsedActual - expectedCash;

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

      {/* Tips & Totals */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div className="bg-amber-50 rounded-lg p-3 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs sm:text-sm text-amber-700">{t('reports.tipsCollected')}</p>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-amber-700">
            {formatPrice(data.tipsCollected)}
          </p>
        </div>

        {data.totalDiscounts > 0 && (
          <div className="bg-orange-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs sm:text-sm text-orange-700">{t('reports.totalDiscounts')}</p>
              <TrendingDown className="h-4 w-4 text-orange-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-orange-700">
              {formatPrice(data.totalDiscounts)}
            </p>
          </div>
        )}
      </div>

      {/* Cash Reconciliation */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">{t('reports.expectedCash')}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('reports.expectedCash')}</p>
            <p className="text-lg font-bold text-gray-900">{formatPrice(expectedCash)}</p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {t('reports.actualCashCount')}
            </label>
            <NumberInput
              value={actualCash}
              onChange={setActualCash}
              min={0}
              step={0.01}
              placeholder="0.00"
            />
          </div>

          {parsedActual > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">{t('reports.cashVariance')}</p>
              <p
                className={`text-lg font-bold ${variance >= 0 ? 'text-green-700' : 'text-red-700'}`}
              >
                {variance >= 0 ? '+' : ''}
                {formatPrice(variance)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
