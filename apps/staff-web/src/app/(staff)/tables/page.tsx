'use client';

import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import { Package, Plus, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
import { CreateTakeoutModal } from '@/components/modals/create-takeout-modal';
import { TableModal } from '@/components/modals/table-modal';
import { TableTransferModal } from '@/components/modals/table-transfer-modal';
import { TableCard } from '@/components/tables/table-card';
import {
  useCleanupEmptyOrders,
  useDeleteTable,
  useOrders,
  useTables,
  useWaiterCalls,
} from '@/hooks';
import { useAuth } from '@/hooks/use-auth';
import { useFormatPrice } from '@/hooks/use-format-price';
import { supabase } from '@/lib/supabase/client';

export default function TablesPage() {
  const { t } = useTranslation('staff');
  const router = useRouter();
  const { staff } = useAuth();
  const {
    data: tables,
    isLoading: tablesLoading,
    error: tablesError,
    refetch: refetchTables,
  } = useTables();
  const { data: orders } = useOrders();
  const { data: waiterCalls } = useWaiterCalls();
  const deleteTable = useDeleteTable();

  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTakeoutModalOpen, setIsTakeoutModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState<string | null>(null);
  const [deleteConfirmTable, setDeleteConfirmTable] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const cleanupEmptyOrders = useCleanupEmptyOrders();
  const isAdmin = staff?.role === 'admin' || staff?.role === 'owner';
  const formatPrice = useFormatPrice();

  // Cleanup stale empty orders on page load (run once)
  const didCleanup = useRef(false);
  useEffect(() => {
    if (!didCleanup.current) {
      didCleanup.current = true;
      cleanupEmptyOrders.mutate(undefined);
    }
  }, [cleanupEmptyOrders]);

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('tables-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        refetchTables();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        refetchTables();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        refetchTables();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, () => {
        refetchTables();
      })
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

  // Get all active orders for a table (including pending_approval)
  const getActiveOrdersForTable = (tableId: string) => {
    return (
      orders?.filter(
        (order: any) =>
          order.table_id === tableId &&
          ['pending_approval', 'new', 'preparing', 'ready', 'served'].includes(order.status),
      ) || []
    );
  };

  // Get active waiter calls for a table
  const getActiveCallsForTable = (tableId: string) => {
    return (
      waiterCalls?.filter((call: any) => call.table_id === tableId && call.status === 'pending') ||
      []
    );
  };

  // Handle delete table — open confirmation modal
  const handleDeleteTable = (table: any) => {
    const activeOrders = getActiveOrdersForTable(table.id);
    if (activeOrders.length > 0) {
      toast.error(t('tables.cannotDeleteActiveOrder'));
      return;
    }
    setDeleteConfirmTable(table);
  };

  const confirmDeleteTable = async () => {
    if (!deleteConfirmTable) return;
    setIsDeleting(true);
    try {
      await deleteTable.mutateAsync(deleteConfirmTable.id);
      toast.success(`${deleteConfirmTable.table_number} ${t('tables.tableDeleted')}`);
      refetchTables();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('tables.failedDeleteTable');
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmTable(null);
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
        <h1 className="text-xl sm:text-2xl font-bold">{t('tables.title')}</h1>
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
              <span className="hidden xs:inline">{t('tables.addTable')}</span>
              <span className="xs:hidden">{t('add', { ns: 'common' })}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTakeoutModalOpen(true)}
            className="flex items-center gap-2 border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-500"
          >
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">{t('tables.takeoutOrder')}</span>
            <span className="sm:hidden">{t('tables.takeout')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchTables()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">{t('refresh', { ns: 'common' })}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {tables?.map((table: any) => {
          const activeOrders = getActiveOrdersForTable(table.id);
          const activeCalls = getActiveCallsForTable(table.id);

          return (
            <TableCard
              key={table.id}
              table={table}
              activeOrders={activeOrders}
              activeCalls={activeCalls}
              isAdmin={isAdmin}
              creatingOrderForTable={null}
              tableMenuOpen={tableMenuOpen}
              onTableMenuToggle={setTableMenuOpen}
              onEditTable={(t) => {
                setEditingTable(t);
                setIsTableModalOpen(true);
                setTableMenuOpen(null);
              }}
              onDeleteTable={(t) => {
                handleDeleteTable(t);
                setTableMenuOpen(null);
              }}
              onTransferTable={(t) => {
                setSelectedTable(t);
                setIsTransferModalOpen(true);
              }}
              formatPrice={formatPrice}
            />
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
            toast.success(t('tables.tableTransferred'));
            refetchTables();
          }}
        />
      )}

      <CreateTakeoutModal
        isOpen={isTakeoutModalOpen}
        onClose={() => setIsTakeoutModalOpen(false)}
        onSuccess={(orderId) => {
          setIsTakeoutModalOpen(false);
          toast.success(t('orders.orderCreated'));
          router.push(`/orders/${orderId}/add-items`);
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteConfirmTable}
        onClose={() => setDeleteConfirmTable(null)}
        onConfirm={confirmDeleteTable}
        title={t('tables.deleteTable')}
        message={`${t('tables.deleteTableConfirm')} ${deleteConfirmTable?.table_number}?`}
        confirmLabel={t('delete', { ns: 'common' })}
        cancelLabel={t('cancel', { ns: 'common' })}
        loading={isDeleting}
      />
    </div>
  );
}
