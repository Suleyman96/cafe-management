'use client';

interface PartialPaymentFormProps {
  partialAmount: string;
  onAmountChange: (value: string) => void;
  remainingBalance: number | undefined;
  orderTotal: number;
  currencySymbol: string;
  formatPrice: (amount: number) => string;
  t: (key: string, opts?: any) => string;
}

export function PartialPaymentForm({
  partialAmount,
  onAmountChange,
  remainingBalance,
  orderTotal,
  currencySymbol,
  formatPrice,
  t,
}: PartialPaymentFormProps) {
  const maxAmount = remainingBalance ?? orderTotal;
  const exceedsBalance = (parseFloat(partialAmount) || 0) > maxAmount;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {t('payment.amountToPay')}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
          {currencySymbol}
        </span>
        <input
          type="number"
          step="0.01"
          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.00"
          value={partialAmount}
          onChange={(e) => onAmountChange(e.target.value)}
          max={maxAmount}
        />
      </div>
      {exceedsBalance && (
        <p className="text-sm text-red-600 mt-1">
          {t('payment.exceedsBalance', {
            amount: formatPrice(parseFloat(partialAmount) || 0),
            balance: formatPrice(maxAmount),
          })}
        </p>
      )}
    </div>
  );
}
