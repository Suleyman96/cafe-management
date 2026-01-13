'use client';

import { useState, useEffect } from 'react';
import { useCreateTable, useUpdateTable } from '@/hooks';
import { Button } from '@cafe-idare/ui';
import { X } from 'lucide-react';
import { toast } from 'sonner';

interface TableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  table?: any; // If provided, we're editing; otherwise creating
}

export function TableModal({
  isOpen,
  onClose,
  onSuccess,
  table,
}: TableModalProps) {
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();

  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'free' | 'occupied' | 'reserved' | 'closed'>('free');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  const isEditing = !!table;

  // Populate form when editing
  useEffect(() => {
    if (table) {
      setTableNumber(table.table_number || '');
      setCapacity(table.capacity || 4);
      setLocation(table.location || '');
      setStatus(table.status || 'free');
      setIsActive(table.is_active ?? true);
    } else {
      // Reset form for new table
      setTableNumber('');
      setCapacity(4);
      setLocation('');
      setStatus('free');
      setIsActive(true);
    }
  }, [table, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        await updateTable.mutateAsync({
          id: table.id,
          updates: {
            table_number: tableNumber,
            capacity,
            location: location || null,
            status,
            is_active: isActive,
          },
        });
        toast.success('Table updated successfully');
      } else {
        // Generate a simple QR code value (in production, use proper QR generation)
        const qrCode = `table-${tableNumber}-${Date.now()}`;

        await createTable.mutateAsync({
          table_number: tableNumber,
          capacity,
          location: location || null,
          status,
          is_active: isActive,
          qr_code: qrCode,
        });
        toast.success('Table created successfully');
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${isEditing ? 'update' : 'create'} table`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isEditing ? `Edit Table ${table.table_number}` : 'Add New Table'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table Number *
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., T01, A1, Patio-1"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (seats) *
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={capacity}
              onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location / Zone
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Main Hall, Patio, VIP Section"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="free">Free</option>
              <option value="occupied">Occupied</option>
              <option value="reserved">Reserved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Table is active (visible in the system)
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Add Table')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
