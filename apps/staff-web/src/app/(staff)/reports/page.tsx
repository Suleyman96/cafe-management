'use client';

import { useLocale, useTranslation } from '@gustri/i18n';
import { LoadingSpinner } from '@gustri/ui-web';
import * as Sentry from '@sentry/nextjs';
import { KeyMetricsGrid } from '@/components/reports/key-metrics-grid';
import { OrderBreakdownSection } from '@/components/reports/order-breakdown-section';
import { OrderStatusSection } from '@/components/reports/order-status-section';
import { ProfitLossSection } from '@/components/reports/profit-loss-section';
import { ReportToolbar } from '@/components/reports/report-toolbar';
import { StaffPerformanceSection } from '@/components/reports/staff-performance-section';
import { useReportDateRange } from '@/components/reports/use-report-date-range';
import { useReportMetrics } from '@/components/reports/use-report-metrics';
import { WasteSection } from '@/components/reports/waste-section';
import { ZReportSection } from '@/components/reports/z-report-section';
import { useAuth } from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';
import { exportReportToPDF } from '@/lib/report-pdf-export';

export default function ReportsPage() {
  const { t } = useTranslation('staff');
  const locale = useLocale();
  const { staff: currentUser } = useAuth();
  const tenantId = currentUser?.tenant_id;
  const formatPrice = useFormatPrice();

  const {
    dateRange,
    setDateRange,
    customMode,
    setCustomMode,
    selectedDate,
    setSelectedDate,
    dateStrings,
    expenseDateRange,
    canNavigateNext,
    navigateDate,
    todayString,
    currentMonthString,
    getDateRangeLabel,
  } = useReportDateRange();

  const { metrics, profitMetrics, wasteMetrics, staffPerformance, zReportData, loading } =
    useReportMetrics({ tenantId, dateStrings, expenseDateRange });

  // Export to PDF — async because it lazy-loads the embedded Unicode font.
  // The PDF now renders the localized label/strings directly (no English-only
  // fallback), so it gets the locale-aware label + `t`.
  const exportToPDF = async () => {
    try {
      await exportReportToPDF({
        metrics,
        profitMetrics,
        wasteMetrics,
        staffPerformance,
        zReport: zReportData,
        dateRangeLabel: getDateRangeLabel(),
        formatPrice,
        locale,
        t,
      });
    } catch (err) {
      Sentry.captureException(err);
    }
  };

  if (currentUser?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">{t('reports.ownerAccessRequired')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <ReportToolbar
        dateRange={dateRange}
        setDateRange={setDateRange}
        customMode={customMode}
        setCustomMode={setCustomMode}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        canNavigateNext={canNavigateNext}
        navigateDate={navigateDate}
        todayString={todayString}
        currentMonthString={currentMonthString}
        getDateRangeLabel={getDateRangeLabel}
        onExport={exportToPDF}
      />

      {/* Key Metrics Grid */}
      <KeyMetricsGrid metrics={metrics} formatPrice={formatPrice} />

      {/* Profit & Loss Summary */}
      <ProfitLossSection
        metrics={metrics}
        profitMetrics={profitMetrics}
        formatPrice={formatPrice}
      />

      {/* Z-Report */}
      <ZReportSection data={zReportData} formatPrice={formatPrice} />

      {/* Waste Summary */}
      <WasteSection wasteMetrics={wasteMetrics} formatPrice={formatPrice} />

      {/* Order Types + Sold Items */}
      <OrderBreakdownSection metrics={metrics} formatPrice={formatPrice} />

      {/* Order Status Summary */}
      <OrderStatusSection metrics={metrics} />

      {/* Staff Performance */}
      <StaffPerformanceSection staffPerformance={staffPerformance} formatPrice={formatPrice} />
    </div>
  );
}
