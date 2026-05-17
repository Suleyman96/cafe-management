'use client';

import { downloadCsv, getLocalDateString, toCsv } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import { AlertTriangle, CheckCircle2, Download, Printer, Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth, useShiftReconciliation } from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';

// Plan 14 — closing-manager view: did the shift balance? Renders the four
// JSONB sections returned by get_shift_reconciliation as a single screen
// with a print-friendly stylesheet (`print:` Tailwind classes hide
// chrome). Owner-gated, mirroring the parent /reports page.

export default function ShiftReconciliationPage() {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const tenantId = staff?.tenant_id;
  const formatPrice = useFormatPrice();

  // Default to today's local-time window, exposed as a date input. The hook
  // expects ISO timestamps; we expand the date to start-of-day → next-day
  // to capture late-night closes.
  const [date, setDate] = useState<string>(getLocalDateString());
  const [endDate, setEndDate] = useState<string>(getLocalDateString());

  const { from, to } = useMemo(() => {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    end.setDate(end.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [date, endDate]);

  const { data, isLoading } = useShiftReconciliation(tenantId, from, to);

  if (staff && staff.role !== 'owner' && staff.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('reports.ownerAccessRequired')}</p>
      </div>
    );
  }

  const summary = data?.summary;
  // Discrepancy = (payments + comps) - expected. Zero means everything
  // accounted for. Positive means we collected more than the order totals
  // (rare; usually a tip recorded as payment). Negative means a leak.
  const discrepancy = summary
    ? Number(summary.payments_received) +
      Number(summary.comps_total) -
      Number(summary.expected_revenue)
    : 0;
  const balanced = Math.abs(discrepancy) < 0.01;

  const handlePrint = () => window.print();

  const handleExport = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    rows.push([t('reconciliation.title')]);
    rows.push([t('reconciliation.from'), date]);
    rows.push([t('reconciliation.to'), endDate]);
    rows.push([]);
    rows.push([t('reconciliation.expectedTotal'), Number(summary?.expected_revenue ?? 0)]);
    rows.push([t('reconciliation.actualTotal'), Number(summary?.payments_received ?? 0)]);
    rows.push([t('reconciliation.tipsCollected'), Number(summary?.tips_collected ?? 0)]);
    rows.push([t('reconciliation.refundsTotal'), Number(summary?.refunds_total ?? 0)]);
    rows.push([t('reconciliation.compsTotal'), Number(summary?.comps_total ?? 0)]);
    rows.push([t('reconciliation.discrepancy'), discrepancy]);
    rows.push([]);
    rows.push([t('reconciliation.byPaymentMethod')]);
    rows.push([
      t('reconciliation.cash'),
      t('reconciliation.amount'),
      t('reconciliation.tipsCollected'),
      t('reconciliation.paymentsTaken'),
    ]);
    for (const m of data.by_method ?? []) {
      rows.push([m.payment_method, Number(m.amount), Number(m.tips), m.payment_count]);
    }
    rows.push([]);
    rows.push([t('reconciliation.perStaff')]);
    rows.push([
      t('reconciliation.staffName'),
      t('reconciliation.ordersHandled'),
      t('reconciliation.amount'),
      t('reconciliation.paymentsTaken'),
    ]);
    for (const r of data.per_staff ?? []) {
      rows.push([r.staff_name, r.orders_handled, Number(r.payments_collected), r.payment_count]);
    }
    rows.push([]);
    rows.push([t('reconciliation.compsTotal')]);
    rows.push([
      t('reconciliation.compReason.other'),
      t('reconciliation.compCount'),
      t('reconciliation.amount'),
    ]);
    for (const c of data.comps ?? []) {
      rows.push([
        t(`reconciliation.compReason.${c.reason}`, { defaultValue: c.reason }),
        c.comp_count,
        Number(c.amount),
      ]);
    }
    downloadCsv(`shift-reconciliation-${date}_to_${endDate}.csv`, toCsv(rows));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 print:py-0 print:px-0">
      {/* Header — hidden in print to keep the printout clean */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-6 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('reconciliation.title')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">{t('reconciliation.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">{t('reconciliation.from')}</label>
            <input
              type="date"
              value={date}
              max={getLocalDateString()}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">{t('reconciliation.to')}</label>
            <input
              type="date"
              value={endDate}
              max={getLocalDateString()}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <Button onClick={handleExport} size="sm" variant="outline" disabled={!data}>
            <Download className="h-4 w-4 mr-2" />
            {t('reconciliation.exportCsv')}
          </Button>
          <Button onClick={handlePrint} size="sm" variant="outline" disabled={!data}>
            <Printer className="h-4 w-4 mr-2" />
            {t('reconciliation.print')}
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">{t('reconciliation.title')}</h1>
        <p className="text-xs">
          {t('reconciliation.from')}: {date} — {t('reconciliation.to')}: {endDate}
        </p>
      </div>

      {!summary || summary.order_count === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-sm text-gray-500">
          {t('reconciliation.noData')}
        </div>
      ) : (
        <>
          {/* Headline cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <SummaryCard
              label={t('reconciliation.expectedTotal')}
              hint={t('reconciliation.expectedHint')}
              value={formatPrice(Number(summary.expected_revenue))}
              tone="neutral"
            />
            <SummaryCard
              label={t('reconciliation.actualTotal')}
              hint={t('reconciliation.actualHint')}
              value={formatPrice(Number(summary.payments_received))}
              tone="positive"
            />
            <SummaryCard
              label={t('reconciliation.refundsTotal')}
              value={formatPrice(Number(summary.refunds_total))}
              tone={Number(summary.refunds_total) > 0 ? 'warning' : 'neutral'}
            />
            <SummaryCard
              label={t('reconciliation.compsTotal')}
              hint={t('reconciliation.compsHint')}
              value={formatPrice(Number(summary.comps_total))}
              tone={Number(summary.comps_total) > 0 ? 'warning' : 'neutral'}
            />
          </div>

          {/* Balance/Discrepancy banner */}
          <div
            className={`rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6 flex items-start gap-3 ${
              balanced
                ? 'bg-green-50 border border-green-200'
                : 'bg-amber-50 border border-amber-200'
            }`}
          >
            {balanced ? (
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Scale className="h-4 w-4 text-gray-500" />
                <h2 className="text-base sm:text-lg font-semibold">
                  {balanced ? t('reconciliation.balanced') : t('reconciliation.discrepancy')}
                </h2>
              </div>
              {!balanced && (
                <p
                  className={`text-lg sm:text-2xl font-bold ${
                    discrepancy > 0 ? 'text-amber-800' : 'text-red-700'
                  }`}
                >
                  {discrepancy > 0 ? t('reconciliation.over') : t('reconciliation.under')}{' '}
                  {formatPrice(Math.abs(discrepancy))}
                </p>
              )}
            </div>
          </div>

          {/* By payment method */}
          {data && data.by_method.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6 print:shadow-none print:border print:border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold mb-3">
                {t('reconciliation.byPaymentMethod')}
              </h2>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">{t('reconciliation.cash')}</th>
                    <th className="text-right py-2">{t('reconciliation.amount')}</th>
                    <th className="text-right py-2">{t('reconciliation.tipsCollected')}</th>
                    <th className="text-right py-2">{t('reconciliation.paymentsTaken')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_method.map((m) => (
                    <tr key={m.payment_method} className="border-b last:border-b-0">
                      <td className="py-2 capitalize">
                        {t(`reconciliation.${m.payment_method}`, {
                          defaultValue: m.payment_method,
                        })}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatPrice(Number(m.amount))}
                      </td>
                      <td className="py-2 text-right text-gray-600">
                        {formatPrice(Number(m.tips))}
                      </td>
                      <td className="py-2 text-right text-gray-600">{m.payment_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per staff */}
          {data && data.per_staff.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6 print:shadow-none print:border print:border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold mb-3">
                {t('reconciliation.perStaff')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead className="text-xs text-gray-500 border-b">
                    <tr>
                      <th className="text-left py-2">{t('reconciliation.staffName')}</th>
                      <th className="text-right py-2">{t('reconciliation.ordersHandled')}</th>
                      <th className="text-right py-2">{t('reconciliation.paymentsTaken')}</th>
                      <th className="text-right py-2">{t('reconciliation.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.per_staff.map((r) => (
                      <tr key={r.staff_id} className="border-b last:border-b-0">
                        <td className="py-2">{r.staff_name}</td>
                        <td className="py-2 text-right">{r.orders_handled}</td>
                        <td className="py-2 text-right">{r.payment_count}</td>
                        <td className="py-2 text-right font-medium">
                          {formatPrice(Number(r.payments_collected))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Comps */}
          {data && data.comps.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6 print:shadow-none print:border print:border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold mb-3">
                {t('reconciliation.compsTotal')}{' '}
                <span className="text-xs text-gray-500">({summary.comp_count})</span>
              </h2>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">{t('reconciliation.compReason.other')}</th>
                    <th className="text-right py-2">{t('reconciliation.compCount')}</th>
                    <th className="text-right py-2">{t('reconciliation.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comps.map((c) => (
                    <tr key={c.reason} className="border-b last:border-b-0">
                      <td className="py-2">
                        {t(`reconciliation.compReason.${c.reason}`, { defaultValue: c.reason })}
                      </td>
                      <td className="py-2 text-right">{c.comp_count}</td>
                      <td className="py-2 text-right font-medium">
                        {formatPrice(Number(c.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  hint,
  value,
  tone,
}: {
  label: string;
  hint?: string;
  value: string;
  tone: 'neutral' | 'positive' | 'warning';
}) {
  const palette =
    tone === 'positive'
      ? 'bg-green-50 text-green-800'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-white text-gray-900';
  return (
    <div className={`rounded-lg shadow p-3 sm:p-4 ${palette} print:shadow-none print:border`}>
      <p className="text-xs sm:text-sm opacity-80">{label}</p>
      <p className="text-lg sm:text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-[10px] sm:text-xs opacity-70 mt-1">{hint}</p>}
    </div>
  );
}
