'use client';

import { useState, useEffect } from 'react';
import { useTables, useOrders, useWaiterCalls, useCreateOrder, useDeleteTable, useCafeSettings, formatPriceWithSettings } from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { Button, LoadingSpinner } from '@cafe-idare/ui';
import { TableTransferModal } from '@/components/modals/table-transfer-modal';
import { CreateTakeoutModal } from '@/components/modals/create-takeout-modal';
import { TableModal } from '@/components/modals/table-modal';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Package,
  Users,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  UserCheck,
  ChefHat,
  CheckCircle,
  UtensilsCrossed,
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
  const { data: cafeSettings } = useCafeSettings();

  // Format price using cafe settings or fallback
  const formatPrice = (amount: number) => {
    if (cafeSettings) {
      return formatPriceWithSettings(amount, cafeSettings);
    }
    return `$${amount.toFixed(2)}`;
  };

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
        { event: '*', schema: 'public', table: 'order_items' },
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

  // Get all active orders for a table
  const getActiveOrdersForTable = (tableId: string) => {
    return orders?.filter((order: any) =>
      order.table_id === tableId &&
      ['new', 'preparing', 'ready', 'served'].includes(order.status)
    ) || [];
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

  // Get effective status based on item statuses
  const getEffectiveOrderStatus = (order: any) => {
    if (!order?.order_items || order.order_items.length === 0) {
      return order.status;
    }

    const items = order.order_items;
    const allServed = items.every((item: any) => item.status === 'served');
    const allReady = items.every((item: any) => item.status === 'ready' || item.status === 'served');
    const anyReady = items.some((item: any) => item.status === 'ready');
    const anyPreparing = items.some((item: any) => item.status === 'preparing');

    if (allServed) return 'served';
    if (allReady) return 'ready';
    if (anyReady) return 'partially_ready';
    if (anyPreparing) return 'preparing';
    return order.status;
  };

  // Get order status badge styling
  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-800',
          border: 'border-blue-300',
          icon: <AlertCircle className="h-3.5 w-3.5" />,
          label: 'New Order'
        };
      case 'preparing':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          border: 'border-yellow-300',
          icon: <ChefHat className="h-3.5 w-3.5" />,
          label: 'Preparing'
        };
      case 'ready':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          border: 'border-green-300',
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: 'Ready'
        };
      case 'served':
        return {
          bg: 'bg-purple-100',
          text: 'text-purple-800',
          border: 'border-purple-300',
          icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
          label: 'Served'
        };
      case 'partially_ready':
        return {
          bg: 'bg-lime-100',
          text: 'text-lime-800',
          border: 'border-lime-400',
          icon: <CheckCircle className="h-3.5 w-3.5" />,
          label: 'Partially Ready'
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          border: 'border-gray-300',
          icon: null,
          label: status
        };
    }
  };

  // Get table card background based on status and orders
  const getTableCardStyle = (table: any, activeOrders: any[]) => {
    if (!table.is_active) {
      return 'bg-gray-100 border-gray-300 opacity-60';
    }
    if (table.status === 'closed') {
      return 'bg-gray-200 border-gray-400';
    }
    if (table.status === 'reserved') {
      return 'bg-blue-50 border-blue-300';
    }
    if (table.status === 'occupied' && activeOrders.length > 0) {
      // If multiple orders, use amber/orange to indicate complexity
      if (activeOrders.length > 1) {
        return 'bg-amber-50 border-amber-400';
      }
      const effectiveStatus = getEffectiveOrderStatus(activeOrders[0]);
      if (effectiveStatus === 'served') {
        return 'bg-purple-50 border-purple-400';
      }
      if (effectiveStatus === 'ready') {
        return 'bg-green-50 border-green-400';
      }
      if (effectiveStatus === 'partially_ready') {
        return 'bg-lime-50 border-lime-400';
      }
      if (effectiveStatus === 'preparing') {
        return 'bg-yellow-50 border-yellow-400';
      }
      if (effectiveStatus === 'new') {
        return 'bg-blue-50 border-blue-400';
      }
      return 'bg-orange-50 border-orange-300';
    }
    // Free table
    return 'bg-white border-gray-200 hover:border-gray-400 hover:shadow-md';
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
    const activeOrders = getActiveOrdersForTable(table.id);
    if (activeOrders.length > 0) {
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
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header - Stack on mobile */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Table Management</h1>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button
              onClick={() => {
                setEditingTable(null);
                setIsTableModalOpen(true);
              }}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden xs:inline">Add Table</span>
              <span className="xs:hidden">Add</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTakeoutModalOpen(true)}
            className="flex items-center gap-2 border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-500"
          >
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Takeout Order</span>
            <span className="sm:hidden">Takeout</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchTables()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {tables?.map((table: any) => {
          const activeOrders = getActiveOrdersForTable(table.id);
          const hasMultipleOrders = activeOrders.length > 1;
          const activeOrder = activeOrders[0]; // First order for time display
          const activeCalls = getActiveCallsForTable(table.id);
          const hasActiveCalls = activeCalls.length > 0;

          // Calculate combined total for all orders
          const combinedTotal = activeOrders.reduce((total: number, order: any) => {
            return total + calculateOrderTotal(order);
          }, 0);

          // Calculate combined items count
          const combinedItemsCount = activeOrders.reduce((count: number, order: any) => {
            return count + (order.order_items?.length || 0);
          }, 0);

          return (
            <div
              key={table.id}
              className={`
                border-2 rounded-xl p-4 cursor-pointer transition-all relative shadow-sm
                ${getTableCardStyle(table, activeOrders)}
                ${hasActiveCalls ? 'ring-2 ring-red-500 ring-offset-2' : ''}
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
                    className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
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

              {/* Table Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                    Table {table.table_number}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      table.status === 'free' ? 'bg-gray-100 text-gray-600' :
                      table.status === 'occupied' ? 'bg-orange-100 text-orange-700' :
                      table.status === 'reserved' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                    </span>
                    {table.location && (
                      <span className="text-xs text-gray-500">{table.location}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {table.capacity} seats
                  </p>
                </div>
                {hasActiveCalls && (
                  <div className="bg-red-500 text-white p-2 rounded-full animate-bounce">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                )}
              </div>

              {/* Active Order Info */}
              {activeOrders.length > 0 && (
                <div className="space-y-3 border-t border-gray-200/50 pt-3 mt-3">
                  {/* Multiple Orders Indicator */}
                  {hasMultipleOrders && (
                    <div className="bg-amber-100 border border-amber-300 rounded-lg px-3 py-1.5 text-sm font-medium text-amber-800 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {activeOrders.length} orders on this table
                    </div>
                  )}

                  {/* Order Status Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {activeOrders.map((order: any, index: number) => {
                      const orderEffectiveStatus = getEffectiveOrderStatus(order);
                      const orderStatusBadge = getOrderStatusBadge(orderEffectiveStatus);
                      return (
                        <div
                          key={order.id}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${orderStatusBadge.bg} ${orderStatusBadge.text} ${orderStatusBadge.border}`}
                        >
                          {orderStatusBadge.icon}
                          {hasMultipleOrders ? `#${index + 1} ${orderStatusBadge.label}` : orderStatusBadge.label}
                        </div>
                      );
                    })}
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{formatDuration((activeOrder as any).created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span>{combinedItemsCount} items</span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-600">{hasMultipleOrders ? 'Combined Total' : 'Total'}</span>
                    <span className="text-lg font-bold text-gray-800">
                      {formatPrice(combinedTotal)}
                    </span>
                  </div>

                  {/* Individual Order Totals (if multiple) */}
                  {hasMultipleOrders && (
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {activeOrders.map((order: any, index: number) => (
                        <div key={order.id} className="flex justify-between">
                          <span>Order #{index + 1}</span>
                          <span>{formatPrice(calculateOrderTotal(order))}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Order Taken By */}
                  {(activeOrder as any).assigned_waiter && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <UserCheck className="h-4 w-4 text-green-500" />
                      <span>Taken by: {(activeOrder as any).assigned_waiter.full_name}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Waiter Calls */}
              {activeCalls.map((call: any) => (
                <div key={call.id} className="mt-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="font-semibold text-red-700 text-sm">
                      {call.reason.toUpperCase()}
                    </span>
                  </div>
                  {call.message && (
                    <p className="text-red-600 text-sm mt-1">{call.message}</p>
                  )}
                </div>
              ))}

              {/* Actions */}
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
              ) : table.status === 'free' && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-500 text-center">Click to view table</p>
                </div>
              )}
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
