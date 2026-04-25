'use client';

import { ACTIVE_ORDER_STATUSES } from '@gustri/core';
import type { Table } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui';
import { Plus, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/modals/confirm-dialog';
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
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

export default function TablesPage() {
  const { t } = useTranslation('staff');
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

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState<string | null>(null);
  const [deleteConfirmTable, setDeleteConfirmTable] = useState<Table | null>(null);
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

  // Real-time: invalidate queries on DB changes
  useRealtimeSync('tables-realtime', [
    { table: 'tables', queryKeys: [['tables']] },
    { table: 'orders', queryKeys: [['tables'], ['orders'], ['active_orders']] },
    { table: 'order_items', queryKeys: [['tables'], ['orders']] },
    { table: 'waiter_calls', queryKeys: [['tables'], ['waiter_calls']] },
  ]);

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
        (order) =>
          order.table_id === tableId &&
          (ACTIVE_ORDER_STATUSES as readonly string[]).includes(order.status),
      ) || []
    );
  };

  // Get active waiter calls for a table
  const getActiveCallsForTable = (tableId: string) => {
    return (
      waiterCalls?.filter((call) => call.table_id === tableId && call.status === 'pending') || []
    );
  };

  // Handle delete table — open confirmation modal
  const handleDeleteTable = (table: Table) => {
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
            onClick={() => refetchTables()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">{t('refresh', { ns: 'common' })}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {tables?.map((table) => {
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
        table={editingTable ?? undefined}
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
