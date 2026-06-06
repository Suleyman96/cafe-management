'use client';

import { getLocalDateString } from '@gustri/core';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import {
  Calendar,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import { StaffPerformanceSection } from '@/components/reports/staff-performance-section';
import {
  type CustomMode,
  type DateRangeType,
  useReportDateRange,
} from '@/components/reports/use-report-date-range';
import { useReportMetrics } from '@/components/reports/use-report-metrics';
import { WasteSection } from '@/components/reports/waste-section';
import { ZReportSection } from '@/components/reports/z-report-section';
import { useAuth } from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';
import { exportReportToPDF } from '@/lib/report-pdf-export';

export default function ReportsPage() {
  const { t } = useTranslation('staff');
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
    getDateRangeLabelEn,
  } = useReportDateRange();

  const { metrics, profitMetrics, wasteMetrics, staffPerformance, zReportData, loading } =
    useReportMetrics({ tenantId, dateStrings, expenseDateRange });

  // Map range keys to translation keys
  const getRangeLabel = (range: DateRangeType): string => {
    switch (range) {
      case 'today':
        return t('reports.today');
      case 'week':
        return t('reports.week');
      case 'month':
        return t('reports.month');
      case 'year':
        return t('reports.year');
      case 'custom':
        return t('reports.custom');
      default:
        return range;
    }
  };

  // Map custom mode keys to translation keys
  const getCustomModeLabel = (mode: CustomMode): string => {
    switch (mode) {
      case 'day':
        return t('reports.day');
      case 'month':
        return t('reports.month');
      case 'year':
        return t('reports.year');
      default:
        return mode;
    }
  };

  // Export to PDF function
  const exportToPDF = () => {
    exportReportToPDF({
      metrics,
      profitMetrics,
      wasteMetrics,
      staffPerformance,
      // English label: the PDF font can't render non-Latin scripts and the
      // filename is derived from it — the export stays English-only.
      dateRangeLabel: getDateRangeLabelEn(),
      formatPrice,
      translateRole: (role) => t(`staffMgmt.role.${role}`),
      translateWasteReason: (reason) =>
        t(`reports.wasteReason.${reason}`, { defaultValue: reason }),
    });
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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{t('reports.title')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 inline mr-1" />
            {getDateRangeLabel()}
          </p>
        </div>

        {/* Date Range Filter + Export Button */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap">
            {(['today', 'week', 'month', 'year', 'custom'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-shrink-0 ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {getRangeLabel(range)}
              </button>
            ))}
          </div>
          <Button
            onClick={exportToPDF}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            size="sm"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs sm:text-sm">{t('reports.exportPdf')}</span>
          </Button>
        </div>
      </div>

      {/* Custom Date Picker */}
      {dateRange === 'custom' && (
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Mode Selection */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-gray-700 mr-1 sm:mr-2">
                {t('reports.viewBy')}
              </span>
              {(['day', 'month', 'year'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCustomMode(mode)}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    customMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {getCustomModeLabel(mode)}
                </button>
              ))}
            </div>

            {/* Date Navigation */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigateDate('prev')}
                className="p-1.5 sm:p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              </button>

              <div className="flex-1 min-w-0 text-center">
                {customMode === 'day' && (
                  <input
                    type="date"
                    value={getLocalDateString(selectedDate)}
                    max={todayString}
                    onChange={(e) => setSelectedDate(new Date(`${e.target.value}T00:00:00`))}
                    className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                )}
                {customMode === 'month' && (
                  <input
                    type="month"
                    value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
                    max={currentMonthString}
                    onChange={(e) => {
                      const [year, month] = e.target.value.split('-');
                      setSelectedDate(new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1));
                    }}
                    className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                )}
                {customMode === 'year' && (
                  <select
                    value={selectedDate.getFullYear()}
                    onChange={(e) => setSelectedDate(new Date(parseInt(e.target.value, 10), 0, 1))}
                    className="w-full sm:w-auto px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(
                      (year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ),
                    )}
                  </select>
                )}
              </div>

              <button
                onClick={() => navigateDate('next')}
                disabled={!canNavigateNext}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0 ${
                  canNavigateNext
                    ? 'bg-gray-100 hover:bg-gray-200'
                    : 'bg-gray-50 cursor-not-allowed'
                }`}
              >
                <ChevronRight
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${canNavigateNext ? 'text-gray-600' : 'text-gray-300'}`}
                />
              </button>

              {/* Quick Jump to Today */}
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium flex-shrink-0"
              >
                {t('today', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-8">
        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <p className="text-xs sm:text-sm text-gray-600">{t('reports.totalRevenue')}</p>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold">{formatPrice(metrics.totalRevenue)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <p className="text-xs sm:text-sm text-gray-600">{t('reports.totalOrders')}</p>
            <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold">{metrics.totalOrders}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <p className="text-xs sm:text-sm text-gray-600">{t('reports.avgOrderShort')}</p>
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold">{formatPrice(metrics.averageOrderValue)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <p className="text-xs sm:text-sm text-gray-600">{t('reports.completion')}</p>
            <ChefHat className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
          </div>
          <p className="text-lg sm:text-2xl font-bold">
            {metrics.totalOrders > 0
              ? Math.round((metrics.completedOrders / metrics.totalOrders) * 100)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Profit & Loss Summary */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-8">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Receipt className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
          <h2 className="text-base sm:text-lg font-semibold">{t('reports.profitLoss')}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <div className="bg-green-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs sm:text-sm text-green-700">{t('reports.revenue')}</p>
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-green-700">
              {formatPrice(metrics.totalRevenue)}
            </p>
          </div>

          <div className="bg-orange-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs sm:text-sm text-orange-700">{t('reports.totalDiscounts')}</p>
              <Receipt className="h-4 w-4 text-orange-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-orange-700">
              {formatPrice(metrics.totalDiscounts)}
            </p>
          </div>

          <div className="bg-red-50 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs sm:text-sm text-red-700">{t('reports.expenses')}</p>
              <Receipt className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-lg sm:text-2xl font-bold text-red-700">
              {formatPrice(profitMetrics.totalExpenses)}
            </p>
          </div>

          <div
            className={`rounded-lg p-3 sm:p-4 ${profitMetrics.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}
          >
            <div className="flex items-center justify-between mb-1">
              <p
                className={`text-xs sm:text-sm ${profitMetrics.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}
              >
                {t('reports.netProfit')}
              </p>
              <TrendingUp
                className={`h-4 w-4 ${profitMetrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
              />
            </div>
            <p
              className={`text-lg sm:text-2xl font-bold ${profitMetrics.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}
            >
              {profitMetrics.netProfit < 0 ? '-' : ''}
              {formatPrice(Math.abs(profitMetrics.netProfit))}
            </p>
            {metrics.totalRevenue > 0 && (
              <p
                className={`text-xs mt-1 ${profitMetrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {profitMetrics.profitMargin.toFixed(1)}% {t('reports.margin')}
              </p>
            )}
          </div>
        </div>

        {profitMetrics.byCategory.length > 0 && (
          <div>
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">
              {t('reports.expenseBreakdown')}
            </h3>
            <div className="space-y-2">
              {profitMetrics.byCategory.map((cat) => {
                const percentage =
                  profitMetrics.totalExpenses > 0
                    ? (cat.total / profitMetrics.totalExpenses) * 100
                    : 0;
                return (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-xs sm:text-sm text-gray-600 w-24 sm:w-28 truncate">
                      {cat.name}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-red-400 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-gray-900 w-20 text-right">
                      {formatPrice(cat.total)}
                    </span>
                    <span className="text-xs text-gray-400 w-8 text-right">
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {profitMetrics.byCategory.length === 0 && (
          <p className="text-gray-500 text-center py-4 text-sm">{t('reports.noExpenses')}</p>
        )}
      </div>

      {/* Z-Report */}
      <ZReportSection data={zReportData} formatPrice={formatPrice} />

      {/* Waste Summary */}
      <WasteSection wasteMetrics={wasteMetrics} formatPrice={formatPrice} />

      {/* Order Types */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-8">
        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
            {t('reports.orderTypes')}
          </h2>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                <span className="text-sm sm:text-base">{t('reports.dineIn')}</span>
              </div>
              <span className="font-medium text-sm sm:text-base">{metrics.dineInOrders}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                <span className="text-sm sm:text-base">{t('reports.takeout')}</span>
              </div>
              <span className="font-medium text-sm sm:text-base">{metrics.takeoutOrders}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Truck className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" />
                <span className="text-sm sm:text-base">{t('reports.delivery')}</span>
              </div>
              <span className="font-medium text-sm sm:text-base">{metrics.deliveryOrders}</span>
            </div>
          </div>
          {metrics.totalOrders > 0 && (
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100">
                <div
                  className="bg-blue-600 h-2"
                  style={{ width: `${(metrics.dineInOrders / metrics.totalOrders) * 100}%` }}
                />
                <div
                  className="bg-green-500 h-2"
                  style={{ width: `${(metrics.takeoutOrders / metrics.totalOrders) * 100}%` }}
                />
                <div
                  className="bg-orange-500 h-2"
                  style={{ width: `${(metrics.deliveryOrders / metrics.totalOrders) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-2 flex-wrap gap-1">
                <span>
                  {t('reports.dineIn')}:{' '}
                  {Math.round((metrics.dineInOrders / metrics.totalOrders) * 100)}%
                </span>
                <span>
                  {t('reports.takeout')}:{' '}
                  {Math.round((metrics.takeoutOrders / metrics.totalOrders) * 100)}%
                </span>
                <span>
                  {t('reports.delivery')}:{' '}
                  {Math.round((metrics.deliveryOrders / metrics.totalOrders) * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sold Items */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold">{t('reports.soldItems')}</h2>
            <span className="text-xs sm:text-sm text-gray-500">
              {t('reports.itemsCount', { count: metrics.soldItems.length })}
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-80 overflow-y-auto">
            {metrics.soldItems.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center">
                <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
                  <span className="text-xs sm:text-sm font-medium text-gray-500">#{index + 1}</span>
                  <span className="truncate text-xs sm:text-sm">{item.name}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="font-medium text-xs sm:text-sm">
                    {t('reports.soldCount', { count: item.count })}
                  </p>
                  <p className="text-xs text-gray-600">{formatPrice(item.revenue)}</p>
                </div>
              </div>
            ))}
            {metrics.soldItems.length === 0 && (
              <p className="text-gray-500 text-center py-4 text-sm">{t('reports.noItemsSold')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Order Status Summary */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-6 mb-4 sm:mb-8">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
          {t('reports.orderStatusSummary')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center">
            <p className="text-xl sm:text-3xl font-bold text-green-600">
              {metrics.completedOrders}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">{t('completed', { ns: 'common' })}</p>
          </div>
          <div className="text-center">
            <p className="text-xl sm:text-3xl font-bold text-red-600">{metrics.cancelledOrders}</p>
            <p className="text-xs sm:text-sm text-gray-600">{t('orders.cancelled')}</p>
          </div>
          <div className="text-center">
            <p className="text-xl sm:text-3xl font-bold text-blue-600">{metrics.totalItems}</p>
            <p className="text-xs sm:text-sm text-gray-600">{t('reports.itemsSold')}</p>
          </div>
          <div className="text-center">
            <p className="text-xl sm:text-3xl font-bold text-purple-600">
              {metrics.totalOrders > 0
                ? (metrics.totalItems / metrics.totalOrders).toFixed(1)
                : '0'}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">{t('reports.itemsPerOrder')}</p>
          </div>
        </div>
      </div>

      {/* Staff Performance */}
      <StaffPerformanceSection staffPerformance={staffPerformance} formatPrice={formatPrice} />
    </div>
  );
}
