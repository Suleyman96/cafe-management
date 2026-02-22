'use client';

import { Button } from '@cafe-idare/ui';
import { AlertTriangle, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth, useOrders, useTables, useTransferTable } from '@/hooks';

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
  const { staff } = useAuth();
  const { data: tables } = useTables();
  const { data: orders } = useOrders();
  const transferTable = useTransferTable();

  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showOccupiedWarning, setShowOccupiedWarning] = useState(false);

  // Get the active order for this table
  const activeOrder = orders?.find(
    (order: any) =>
      order.table_id === sourceTable?.id &&
      ['new', 'preparing', 'ready', 'served'].includes(order.status),
  );

  // Get available tables (all tables except source, sorted by status)
  const availableTables = useMemo(() => {
    if (!tables) return [];
    return tables
      .filter((table: any) => table.id !== sourceTable?.id)
      .sort((a: any, b: any) => {
        // Free tables first, then reserved, then occupied
        const statusOrder: Record<string, number> = { free: 0, reserved: 1, occupied: 2 };
        return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
      });
  }, [tables, sourceTable?.id]);

  // Check if selected table is occupied
  const selectedTable = useMemo(() => {
    return availableTables.find((t: any) => t.id === selectedTableId);
  }, [availableTables, selectedTableId]);

  const isSelectedTableOccupied = selectedTable?.status === 'occupied';

  const handleTableSelect = (tableId: string) => {
    setSelectedTableId(tableId);
    const table = availableTables.find((t: any) => t.id === tableId);
    if (table?.status === 'occupied') {
      setShowOccupiedWarning(true);
    } else {
      setShowOccupiedWarning(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedTableId || !activeOrder) return;

    setLoading(true);
    try {
      await transferTable.mutateAsync({
        orderId: (activeOrder as any).id,
        fromTableId: sourceTable.id,
        toTableId: selectedTableId,
        staffId: staff?.id || '',
        reason: reason.trim() || undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to transfer table:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTableId('');
    setReason('');
    setShowOccupiedWarning(false);
    onClose();
  };

  if (!isOpen) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'free':
        return (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Free</span>
        );
      case 'reserved':
        return (
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
            Reserved
          </span>
        );
      case 'occupied':
        return (
          <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
            Occupied
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Transfer {sourceTable?.table_number}</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
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
              onChange={(e) => handleTableSelect(e.target.value)}
            >
              <option value="">Select a table</option>
              {availableTables?.map((table: any) => (
                <option key={table.id} value={table.id}>
                  {table.table_number} - {table.location || 'Main area'} ({table.status})
                </option>
              ))}
            </select>
            {selectedTable && (
              <div className="mt-2 flex items-center gap-2">
                {getStatusBadge(selectedTable.status)}
                <span className="text-sm text-gray-500">
                  Capacity: {selectedTable.capacity} seats
                </span>
              </div>
            )}
          </div>

          {showOccupiedWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">This table is already occupied</p>
                <p className="text-sm text-amber-600 mt-1">
                  The order will be moved to this table. Both orders will be active on the same
                  table.
                </p>
              </div>
            </div>
          )}

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
          <Button variant="outline" onClick={handleClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedTableId || loading}
            className={`flex-1 ${isSelectedTableOccupied ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
          >
            {loading
              ? 'Transferring...'
              : isSelectedTableOccupied
                ? 'Transfer Anyway'
                : 'Transfer Table'}
          </Button>
        </div>
      </div>
    </div>
  );
}
