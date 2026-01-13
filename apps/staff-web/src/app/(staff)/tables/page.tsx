'use client';

import { useState, useEffect } from 'react';
import { useTables, useOrders, useWaiterCalls, useCreateOrder, useDeleteTable } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { TableTransferModal } from '@/components/modals/table-transfer-modal';
import { CreateTakeoutModal } from '@/components/modals/create-takeout-modal';
import { TableModal } from '@/components/modals/table-modal';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Phone,
  Users,
  Clock,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
} from 'lucide-react';

export default function TablesPage() {
  const { staff } = useAuth();
  const { data: tables, isLoading: tablesLoading, error: tablesError, refetch: refetchTables } = useTables();
  const { data: orders } = useOrders();
  const { data: waiterCalls } = useWaiterCalls();
  const deleteTable = useDeleteTable();

  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTakeoutModalOpen, setIsTakeoutModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [creatingOrderForTable, setCreatingOrderForTable] = useState<string | null>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState<string | null>(null);

  const createOrder = useCreateOrder();
  const isAdmin = staff?.role === 'admin';

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('tables-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => {
          refetchTables();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          refetchTables();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls' },
        () => {
          refetchTables();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchTables]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside a menu
      if (target.closest('[data-table-menu]')) return;
      setTableMenuOpen(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Get active order for a table
  const getActiveOrderForTable = (tableId: string) => {
    return orders?.find((order: any) =>
      order.table_id === tableId &&
      ['new', 'preparing', 'ready', 'served'].includes(order.status)
    );
  };

  // Get active waiter calls for a table
  const getActiveCallsForTable = (tableId: string) => {
    return waiterCalls?.filter((call: any) =>
      call.table_id === tableId &&
      call.status === 'pending'
    ) || [];
  };

  // Calculate order total
  const calculateOrderTotal = (order: any) => {
    if (!order?.order_items) return 0;
    return order.order_items.reduce((sum: number, item: any) =>
      sum + (item.quantity * item.item_price), 0
    );
  };

  // Format duration
  const formatDuration = (createdAt: string) => {
    const start = new Date(createdAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 1000 / 60);

    if (diff < 60) {
      return `${diff}m`;
    } else {
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return `${hours}h ${mins}m`;
    }
  };

  // Handle creating order for a free table
  const handleCreateOrderForTable = async (table: any) => {
    setCreatingOrderForTable(table.id);
    try {
      const result = await createOrder.mutateAsync({
        table_id: table.id,
        order_type: 'dine_in',
        status: 'new',
      } as any);
      toast.success(`Order created for Table ${table.table_number}`);
      window.location.href = `/orders/${result.id}/add-items`;
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error('Failed to create order. Please try again.');
    } finally {
      setCreatingOrderForTable(null);
    }
  };

  // Handle delete table
  const handleDeleteTable = async (table: any) => {
    const activeOrder = getActiveOrderForTable(table.id);
    if (activeOrder) {
      toast.error('Cannot delete table with active order');
      return;
    }

    if (!confirm(`Are you sure you want to delete Table ${table.table_number}?`)) {
      return;
    }

    try {
      await deleteTable.mutateAsync(table.id);
      toast.success(`Table ${table.table_number} deleted`);
      refetchTables();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete table');
    }
  };

  if (tablesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (tablesError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Error loading tables: {tablesError.message}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Table Management</h1>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              onClick={() => {
                setEditingTable(null);
                setIsTableModalOpen(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Table
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setIsTakeoutModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Phone className="h-4 w-4" />
            Takeout Order
          </Button>
          <Button
            variant="outline"
            onClick={() => refetchTables()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tables?.map((table: any) => {
          const activeOrder = getActiveOrderForTable(table.id);
          const activeCalls = getActiveCallsForTable(table.id);
          const hasActiveCalls = activeCalls.length > 0;

          return (
            <div
              key={table.id}
              className={`
                border rounded-lg p-4 cursor-pointer transition-all relative
                ${table.status === 'occupied'
                  ? 'bg-orange-50 border-orange-300'
                  : table.status === 'reserved'
                  ? 'bg-blue-50 border-blue-300'
                  : table.status === 'closed'
                  ? 'bg-gray-200 border-gray-400'
                  : 'bg-gray-50 border-gray-300'
                }
                ${hasActiveCalls ? 'ring-2 ring-red-500 animate-pulse' : ''}
                ${!table.is_active ? 'opacity-50' : ''}
              `}
              onClick={() => {
                if (creatingOrderForTable) return;
                window.location.href = `/tables/${table.id}`;
              }}
            >
              {/* Admin actions menu */}
              {isAdmin && (
                <div className="absolute top-2 right-2" data-table-menu>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setTableMenuOpen(tableMenuOpen === table.id ? null : table.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <MoreVertical className="h-4 w-4 text-gray-500" />
                  </button>

                  {tableMenuOpen === table.id && (
                    <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[120px]" data-table-menu>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTable(table);
                          setIsTableModalOpen(true);
                          setTableMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTable(table);
                          setTableMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-bold">
                    Table {table.table_number}
                  </h3>
                  <p className="text-sm text-gray-600 capitalize">
                    {table.status}
                    {table.location && ` - ${table.location}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {table.capacity} seats
                  </p>
                </div>
                {hasActiveCalls && (
                  <AlertCircle className="h-6 w-6 text-red-500 animate-bounce" />
                )}
              </div>

              {activeOrder && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    {formatDuration((activeOrder as any).created_at)}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4" />
                    {(activeOrder as any).order_items?.length || 0} items
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <DollarSign className="h-4 w-4" />
                    ${calculateOrderTotal(activeOrder).toFixed(2)}
                  </div>
                  <div className="mt-2 px-2 py-1 bg-gray-100 rounded text-xs font-medium capitalize">
                    {(activeOrder as any).status}
                  </div>
                </div>
              )}

              {activeCalls.map((call: any) => (
                <div key={call.id} className="mt-2 p-2 bg-red-100 rounded text-xs">
                  <span className="font-medium text-red-700">
                    {call.reason.toUpperCase()}
                  </span>
                  {call.message && (
                    <p className="text-red-600 mt-1">{call.message}</p>
                  )}
                </div>
              ))}

              {creatingOrderForTable === table.id ? (
                <div className="flex items-center justify-center gap-2 mt-4 text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Creating order...</span>
                </div>
              ) : table.status === 'occupied' ? (
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTable(table);
                      setIsTransferModalOpen(true);
                    }}
                    className="flex-1"
                  >
                    Transfer
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Table Modal (Add/Edit) */}
      <TableModal
        isOpen={isTableModalOpen}
        onClose={() => {
          setIsTableModalOpen(false);
          setEditingTable(null);
        }}
        table={editingTable}
        onSuccess={() => {
          setIsTableModalOpen(false);
          setEditingTable(null);
          refetchTables();
        }}
      />

      {selectedTable && (
        <TableTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setSelectedTable(null);
          }}
          sourceTable={selectedTable}
          onSuccess={() => {
            setIsTransferModalOpen(false);
            setSelectedTable(null);
            toast.success('Table transferred successfully');
            refetchTables();
          }}
        />
      )}

      <CreateTakeoutModal
        isOpen={isTakeoutModalOpen}
        onClose={() => setIsTakeoutModalOpen(false)}
        onSuccess={(orderId) => {
          setIsTakeoutModalOpen(false);
          toast.success('Takeout order created');
          window.location.href = `/orders/${orderId}/add-items`;
        }}
      />
    </div>
  );
}
