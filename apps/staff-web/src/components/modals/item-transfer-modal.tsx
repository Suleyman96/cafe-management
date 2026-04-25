'use client';

import type { Database } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button } from '@gustri/ui';
import * as Sentry from '@sentry/nextjs';
import { ArrowRight, Loader2, Minus, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTables, useTransferOrderItems } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';
import type { OrderWithDetails } from '@/types';

type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface ItemTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithDetails;
  sourceTableId: string;
  onSuccess: () => void;
}

export function ItemTransferModal({
  isOpen,
  onClose,
  order,
  sourceTableId,
  onSuccess,
}: ItemTransferModalProps) {
  const { t } = useTranslation('staff');
  const { staff } = useAuth();
  const { data: tables } = useTables();
  const transferItems = useTransferOrderItems();
  const formatPrice = useFormatPrice();

  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  // Map of itemId → quantity to transfer
  const [itemQuantities, setItemQuantities] = useState<Map<string, number>>(new Map());

  // Filter out cancelled items
  const transferableItems: OrderItem[] = useMemo(() => {
    return (order?.order_items || []).filter((item: OrderItem) => item.status !== 'cancelled');
  }, [order?.order_items]);

  // Available tables (exclude source table)
  const availableTables = useMemo(() => {
    if (!tables) return [];
    return tables
      .filter((table) => table.id !== sourceTableId && table.status !== 'closed')
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { free: 0, reserved: 1, occupied: 2 };
        return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
      });
  }, [tables, sourceTableId]);

  const updateItemQuantity = (itemId: string, maxQty: number, delta: number) => {
    setItemQuantities((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(itemId) || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      if (next === 0) {
        newMap.delete(itemId);
      } else {
        newMap.set(itemId, next);
      }
      return newMap;
    });
  };

  const hasSelectedItems = Array.from(itemQuantities.values()).some((q) => q > 0);

  // Calculate total being transferred
  const transferTotal = useMemo(() => {
    let total = 0;
    for (const [itemId, qty] of itemQuantities) {
      if (qty <= 0) continue;
      const item = transferableItems.find((i: OrderItem) => i.id === itemId);
      if (item) {
        total += qty * item.item_price;
      }
    }
    return total;
  }, [itemQuantities, transferableItems]);

  // Summary items for display
  const selectedItemsSummary = useMemo(() => {
    const items: Array<{ name: string; quantity: number }> = [];
    for (const [itemId, qty] of itemQuantities) {
      if (qty <= 0) continue;
      const item = transferableItems.find((i: OrderItem) => i.id === itemId);
      if (item) {
        items.push({ name: item.item_name, quantity: qty });
      }
    }
    return items;
  }, [itemQuantities, transferableItems]);

  const handleTransfer = async () => {
    if (!selectedTableId || !hasSelectedItems || !staff?.id || !order?.id) return;

    const items = Array.from(itemQuantities.entries())
      .filter(([, qty]) => qty > 0)
      .map(([item_id, quantity]) => ({ item_id, quantity }));

    setLoading(true);
    try {
      await transferItems.mutateAsync({
        sourceOrderId: order.id,
        destinationTableId: selectedTableId,
        items,
        staffId: staff.id,
        reason: reason.trim() || undefined,
      });
      onSuccess();
    } catch (error: unknown) {
      Sentry.captureException(error);
      const message = error instanceof Error ? error.message : t('tables.failedTransfer');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTableId('');
    setReason('');
    setItemQuantities(new Map());
    onClose();
  };

  if (!isOpen || !order) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'free':
        return (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
            {t('tables.free')}
          </span>
        );
      case 'reserved':
        return (
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
            {t('tables.reserved')}
          </span>
        );
      case 'occupied':
        return (
          <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
            {t('tables.occupied')}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{t('tables.transferItems')}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Select items to transfer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('tables.selectItemsToTransfer')}
            </label>
            <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
              {transferableItems.map((item: OrderItem) => {
                const selectedQty = itemQuantities.get(item.id) || 0;
                const isSelected = selectedQty > 0;

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">
                        {item.quantity}x {item.item_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatPrice(item.item_price)} {t('payment.each')}
                      </div>
                    </div>

                    {/* Quantity selector */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity, -1)}
                        disabled={selectedQty <= 0}
                        className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{selectedQty}</span>
                      <button
                        onClick={() => updateItemQuantity(item.id, item.quantity, 1)}
                        disabled={selectedQty >= item.quantity}
                        className="h-7 w-7 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Destination table */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('tables.transferToTable')}
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
            >
              <option value="">{t('tables.selectTable')}</option>
              {availableTables?.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.table_number} - {table.location || t('tables.mainArea')} ({table.status})
                </option>
              ))}
            </select>
            {selectedTableId && (
              <div className="mt-2 flex items-center gap-2">
                {getStatusBadge(
                  availableTables.find((tbl) => tbl.id === selectedTableId)?.status || '',
                )}
              </div>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('tables.reasonOptional')}
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('tables.transferReasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Transfer summary */}
          {hasSelectedItems && selectedTableId && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-800 mb-2">
                <ArrowRight className="h-4 w-4" />
                {t('tables.transferSummary')}
              </div>
              <div className="space-y-1">
                {selectedItemsSummary.map((item) => (
                  <div key={`${item.name}-${item.quantity}`} className="text-sm text-blue-700">
                    {item.quantity}x {item.name}
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200 text-sm font-medium text-blue-800">
                {t('total', { ns: 'common' })}: {formatPrice(transferTotal)}
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-6 flex gap-3">
          <Button variant="outline" onClick={handleClose} disabled={loading} className="flex-1">
            {t('cancel', { ns: 'common' })}
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedTableId || !hasSelectedItems || loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('tables.transferring')}
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                {t('tables.transferItemsBtn')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
