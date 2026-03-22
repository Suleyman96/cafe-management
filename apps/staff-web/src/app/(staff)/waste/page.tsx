'use client';

import type { Database } from '@cafe-idare/database';
import { useTranslation } from '@cafe-idare/i18n';
import { LoadingSpinner } from '@cafe-idare/ui';
import { DollarSign, Pencil, Plus, Trash2, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { WasteLogModal } from '@/components/modals/waste-log-modal';
import { Button } from '@/components/ui/button';
import { useCafeSettings, useDeleteWasteLog, useWasteLogs, useWasteMonthlySummary } from '@/hooks';
import { useFormatPrice } from '@/hooks/use-format-price';

type WasteLog = Database['public']['Tables']['waste_logs']['Row'];

export default function WastePage() {
  const { t } = useTranslation('staff');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [reasonFilter, setReasonFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<WasteLog | null>(null);

  const REASON_LABELS: Record<string, string> = {
    expired: t('waste.expired'),
    spoiled: t('waste.spoiled'),
    overcooked: t('waste.overcooked'),
    dropped: t('waste.dropped'),
    returned_by_customer: t('waste.returnedByCustomer'),
    preparation_waste: t('waste.preparationWaste'),
    other: t('waste.other'),
  };

  const REASON_COLORS: Record<string, string> = {
    expired: 'bg-red-100 text-red-700',
    spoiled: 'bg-orange-100 text-orange-700',
    overcooked: 'bg-yellow-100 text-yellow-700',
    dropped: 'bg-purple-100 text-purple-700',
    returned_by_customer: 'bg-blue-100 text-blue-700',
    preparation_waste: 'bg-gray-100 text-gray-700',
    other: 'bg-gray-100 text-gray-600',
  };

  const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const endMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const endYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data: wasteLogs = [], isLoading } = useWasteLogs({
    startDate,
    endDate,
    reason: reasonFilter || undefined,
  });
  const { data: summary } = useWasteMonthlySummary(selectedYear, selectedMonth);
  const formatPrice = useFormatPrice();
  const { data: cafeSettings } = useCafeSettings();
  const deleteWaste = useDeleteWasteLog();

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this waste log?')) return;
    try {
      await deleteWaste.mutateAsync(id);
      toast.success(t('waste.wasteLogDeleted'));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('delete', { ns: 'common' });
      toast.error(message);
    }
  };

  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!cafeSettings?.waste_tracking_enabled) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">{t('waste.disabledMessage')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('waste.title')}</h1>
          <p className="text-gray-500 mt-1">{t('waste.subtitle')}</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('waste.logWaste')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('waste.monthlyWasteCost')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(summary?.totalCost || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <TrendingDown className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('waste.wasteEvents')}</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.count || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Trash2 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('waste.topReason')}</p>
              <p className="text-lg font-bold text-gray-900 truncate">
                {summary?.byReason?.[0]
                  ? REASON_LABELS[summary.byReason[0].reason] || summary.byReason[0].reason
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reason Breakdown */}
      {summary?.byReason && summary.byReason.length > 0 && (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{t('waste.byReason')}</h3>
          <div className="space-y-2">
            {summary.byReason.map((item: any) => {
              const percentage = summary.totalCost > 0 ? (item.total / summary.totalCost) * 100 : 0;
              return (
                <div key={item.reason} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 truncate">
                    {REASON_LABELS[item.reason] || item.reason}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-20 text-right">
                    {formatPrice(item.total)}
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number.parseInt(e.target.value, 10))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {Array.from({ length: 2 }, (_, i) => {
            const y = now.getFullYear() - i;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number.parseInt(e.target.value, 10))}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {months.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">{t('waste.allReasons')}</option>
          {Object.entries(REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Waste Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('date', { ns: 'common' })}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('waste.menuItem')}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                  {t('quantity', { ns: 'common' })}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                  {t('amount', { ns: 'common' })}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('waste.wasteReason')}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">
                  {t('staffMgmt.staffMember')}
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">
                  {t('actions', { ns: 'common' })}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {wasteLogs.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(log.waste_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-xs">{log.item_name}</p>
                    {log.notes && (
                      <p className="text-xs text-gray-500 truncate max-w-xs">{log.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {log.quantity} {log.unit}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-red-600 text-right">
                    {formatPrice(log.total_cost)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${REASON_COLORS[log.reason] || 'bg-gray-100 text-gray-600'}`}
                    >
                      {REASON_LABELS[log.reason] || log.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {log.logged_by_staff?.full_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingLog(log);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        title={t('edit', { ns: 'common' })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                        title={t('delete', { ns: 'common' })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {wasteLogs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {t('waste.noWaste')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <WasteLogModal
          wasteLog={editingLog || undefined}
          onClose={() => {
            setShowModal(false);
            setEditingLog(null);
          }}
        />
      )}
    </div>
  );
}
