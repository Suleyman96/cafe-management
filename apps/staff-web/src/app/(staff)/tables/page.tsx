'use client';

import { ACTIVE_ORDER_STATUSES } from '@gustri/core';
import type { OrderWithDetails, Table, WaiterCalls } from '@gustri/database';
import { useTranslation } from '@gustri/i18n';
import { QUERY_KEYS, tenantKey, useTenantId } from '@gustri/queries';
import { Button, LoadingSpinner } from '@gustri/ui';
import { Plus, RefreshCw, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useCanPerform } from '@/hooks/use-can-perform';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';
import { toastLocalizedError } from '@/lib/toast/localized-error';

// Module-level stable empty arrays — sharing one reference per render keeps
// memoized TableCards from re-rendering on tables with no orders/calls.
const EMPTY_ORDERS: OrderWithDetails[] = [];
const EMPTY_CALLS: WaiterCalls[] = [];

export default function TablesPage() {
  const { t } = useTranslation('staff');
  const {
    data: tables,
    isLoading: tablesLoading,
    error: tablesError,
    refetch: refetchTables,
  } = useTables();
  // Tables overview only consumes active orders to render per-table totals.
  // Filtering by active statuses + a hard cap keeps the payload bounded.
  const { data: orders } = useOrders({
    statuses: ['pending_approval', 'new', 'preparing', 'ready', 'served'],
    limit: 200,
  });
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
  const isAdmin = useCanPerform('manage_tables');
  const formatPrice = useFormatPrice();
  const tenantId = useTenantId();

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
    {
      table: 'tables',
      queryKeys: [tenantKey(tenantId, QUERY_KEYS.TABLES)],
    },
    {
      table: 'orders',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.TABLES),
        tenantKey(tenantId, QUERY_KEYS.ORDERS),
        tenantKey(tenantId, QUERY_KEYS.ACTIVE_ORDERS),
      ],
    },
    {
      table: 'order_items',
      queryKeys: [tenantKey(tenantId, QUERY_KEYS.TABLES), tenantKey(tenantId, QUERY_KEYS.ORDERS)],
    },
    {
      table: 'waiter_calls',
      queryKeys: [
        tenantKey(tenantId, QUERY_KEYS.TABLES),
        tenantKey(tenantId, QUERY_KEYS.WAITER_CALLS),
      ],
    },
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

  // Bucket orders/calls by table_id once per data change so each TableCard receives
  // referentially stable arrays — recomputing inline per render would defeat memo().
  const ordersByTable = useMemo(() => {
    const map = new Map<string, OrderWithDetails[]>();
    if (!orders) return map;
    for (const order of orders) {
      if (!order.table_id) continue;
      if (!(ACTIVE_ORDER_STATUSES as readonly string[]).includes(order.status)) continue;
      const list = map.get(order.table_id);
      if (list) list.push(order);
      else map.set(order.table_id, [order]);
    }
    return map;
  }, [orders]);

  const callsByTable = useMemo(() => {
    const map = new Map<string, WaiterCalls[]>();
    if (!waiterCalls) return map;
    for (const call of waiterCalls) {
      if (!call.table_id || call.status !== 'pending') continue;
      const list = map.get(call.table_id);
      if (list) list.push(call);
      else map.set(call.table_id, [call]);
    }
    return map;
  }, [waiterCalls]);

  const getActiveOrdersForTable = useCallback(
    (tableId: string) => ordersByTable.get(tableId) ?? EMPTY_ORDERS,
    [ordersByTable],
  );

  const getActiveCallsForTable = useCallback(
    (tableId: string) => callsByTable.get(tableId) ?? EMPTY_CALLS,
    [callsByTable],
  );

  // Handle delete table — open confirmation modal
  const handleDeleteTable = useCallback(
    (table: Table) => {
      const activeOrders = getActiveOrdersForTable(table.id);
      if (activeOrders.length > 0) {
        toast.error(t('tables.cannotDeleteActiveOrder'));
        return;
      }
      setDeleteConfirmTable(table);
    },
    [getActiveOrdersForTable, t],
  );

  const handleEditTable = useCallback((table: Table) => {
    setEditingTable(table);
    setIsTableModalOpen(true);
    setTableMenuOpen(null);
  }, []);

  const handleDeleteTableMenu = useCallback(
    (table: Table) => {
      handleDeleteTable(table);
      setTableMenuOpen(null);
    },
    [handleDeleteTable],
  );

  const handleTransferTable = useCallback((table: Table) => {
    setSelectedTable(table);
    setIsTransferModalOpen(true);
  }, []);

  const confirmDeleteTable = async () => {
    if (!deleteConfirmTable) return;
    setIsDeleting(true);
    try {
      await deleteTable.mutateAsync(deleteConfirmTable.id);
      toast.success(`${deleteConfirmTable.table_number} ${t('tables.tableDeleted')}`);
      refetchTables();
    } catch (error: unknown) {
      toastLocalizedError(error, t('tables.failedDeleteTable'));
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

      {tables?.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-500 mb-1">{t('tables.noTables')}</p>
            <p className="text-sm text-gray-400">{t('tables.noTablesDescription')}</p>
          </div>
        </div>
      ) : (
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
                onEditTable={handleEditTable}
                onDeleteTable={handleDeleteTableMenu}
                onTransferTable={handleTransferTable}
                formatPrice={formatPrice}
              />
            );
          })}
        </div>
      )}

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
