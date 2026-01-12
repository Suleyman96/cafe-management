'use client';

import { useState, useEffect } from 'react';
import { useTables, useOrders, useWaiterCalls, useCreateOrder } from '@/hooks';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { TableTransferModal } from '@/components/modals/table-transfer-modal';
import { CreateTakeoutModal } from '@/components/modals/create-takeout-modal';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Phone,
  Users,
  Clock,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';

export default function TablesPage() {
  const { data: tables, isLoading: tablesLoading, error: tablesError, refetch: refetchTables } = useTables();
  const { data: orders } = useOrders();
  const { data: waiterCalls } = useWaiterCalls();
  
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTakeoutModalOpen, setIsTakeoutModalOpen] = useState(false);
  const [creatingOrderForTable, setCreatingOrderForTable] = useState<string | null>(null);

  const createOrder = useCreateOrder();

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
                border rounded-lg p-4 cursor-pointer transition-all
                ${table.status === 'occupied' 
                  ? 'bg-orange-50 border-orange-300' 
                  : table.status === 'reserved'
                  ? 'bg-blue-50 border-blue-300'
                  : 'bg-gray-50 border-gray-300'
                }
                ${hasActiveCalls ? 'ring-2 ring-red-500 animate-pulse' : ''}
              `}
              onClick={() => {
                if (creatingOrderForTable) return; // Prevent double-click
                // Navigate to table detail page
                window.location.href = `/tables/${table.id}`;
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl font-bold">
                    Table {table.table_number}
                  </h3>
                  <p className="text-sm text-gray-600 capitalize">
                    {table.status}
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