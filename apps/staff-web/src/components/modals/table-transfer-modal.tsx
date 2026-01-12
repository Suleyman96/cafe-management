'use client';

import { useState, useEffect } from 'react';
import { useTables, useTransferTable, useOrders } from '@/hooks';
import { Button } from '@cafe-idare/ui';
import { X } from 'lucide-react';

// Default staff ID for development (Admin User)
const DEFAULT_STAFF_ID = '10000000-0000-0000-0000-000000000001';

interface TableTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTable: any;
  onSuccess: () => void;
}

export function TableTransferModal({
  isOpen,
  onClose,
  sourceTable,
  onSuccess,
}: TableTransferModalProps) {
  const { data: tables } = useTables();
  const { data: orders } = useOrders();
  const transferTable = useTransferTable();
  
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // Get the active order for this table
  const activeOrder = orders?.find((order: any) => 
    order.table_id === sourceTable?.id && 
    ['new', 'preparing', 'ready', 'served'].includes(order.status)
  );

  // Get available tables (free tables only)
  const availableTables = tables?.filter(
    (table: any) => table.status === 'free' && table.id !== sourceTable?.id
  );

  const handleTransfer = async () => {
    if (!selectedTableId || !activeOrder) return;

    setLoading(true);
    try {
      await transferTable.mutateAsync({
        orderId: (activeOrder as any).id,
        fromTableId: sourceTable.id,
        toTableId: selectedTableId,
        staffId: DEFAULT_STAFF_ID,
        reason: reason.trim() || undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to transfer table:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Transfer Table {sourceTable?.table_number}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transfer to Table
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
            >
              <option value="">Select a table</option>
              {availableTables?.map((table: any) => (
                <option key={table.id} value={table.id}>
                  Table {table.table_number} - {table.location || 'Main area'}
                </option>
              ))}
            </select>
            {availableTables?.length === 0 && (
              <p className="text-sm text-red-600 mt-1">No free tables available</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason (optional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Customer requested, Table maintenance"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedTableId || loading}
            className="flex-1"
          >
            {loading ? 'Transferring...' : 'Transfer Table'}
          </Button>
        </div>
      </div>
    </div>
  );
}