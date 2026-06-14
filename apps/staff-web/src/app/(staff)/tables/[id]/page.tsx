'use client';

import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import { Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ItemTransferModal } from '@/components/modals/item-transfer-modal';
import { SplitPaymentModal } from '@/components/modals/split-payment-modal';
import { CancelItemModal } from '@/components/tables/cancel-item-modal';
import { CancelOrderModal } from '@/components/tables/cancel-order-modal';
import { TableCart } from '@/components/tables/table-cart';
import { TableMenuPicker } from '@/components/tables/table-menu-picker';
import { TableOrderHeader } from '@/components/tables/table-order-header';
import { useTableDetail } from '@/components/tables/use-table-detail';

export default function TableDetailPage() {
  const params = useParams();
  const tableId = params.id as string;
  const { t } = useTranslation('staff');

  const {
    table,
    loading,
    categories,
    filteredItems,
    activeOrders,
    activeOrder,
    activeCallsForTable,
    resolveWaiterCall,
    cartTotal,
    orderTotal,
    combinedTotal,
    taxMultiplier,
    formatPrice,
    cart,
    addToCart,
    removeFromCart,
    getCartQuantity,
    selectedCategory,
    setSelectedCategory,
    selectedOrderIndex,
    setSelectedOrderIndex,
    showMenu,
    setShowMenu,
    orderNotes,
    setOrderNotes,
    submitting,
    showCancelModal,
    setShowCancelModal,
    cancelReason,
    setCancelReason,
    cancelling,
    cancelItemConfirm,
    setCancelItemConfirm,
    cancelItemQty,
    setCancelItemQty,
    cancellingItem,
    showItemTransferModal,
    setShowItemTransferModal,
    handleResolveCalls,
    handleCreateOrderWithItems,
    handleAddItemsToOrder,
    handleStatusUpdate,
    handleItemStatusUpdate,
    handleCancelItem,
    handleCancelOrder,
  } = useTableDetail(tableId);

  // Pay the selected order in place — no hop to the order-detail page.
  const [showPayment, setShowPayment] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">{t('tables.tableNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen overflow-hidden">
      {/* ORDER view — owns the screen and scrolls naturally; the catalog is an
          on-demand bottom sheet (below), not a permanent panel competing for height. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Header + Order Info + Current Items */}
        <TableOrderHeader
          table={table}
          activeOrder={activeOrder}
          activeOrders={activeOrders}
          activeCallsForTable={activeCallsForTable}
          resolveWaiterCall={resolveWaiterCall}
          combinedTotal={combinedTotal}
          orderTotal={orderTotal}
          formatPrice={formatPrice}
          selectedOrderIndex={selectedOrderIndex}
          setSelectedOrderIndex={setSelectedOrderIndex}
          onResolveCalls={handleResolveCalls}
          onShowItemTransfer={() => setShowItemTransferModal(true)}
          onShowCancelModal={() => setShowCancelModal(true)}
          onOpenPayment={() => setShowPayment(true)}
          onStatusUpdate={handleStatusUpdate}
          onItemStatusUpdate={handleItemStatusUpdate}
          onCancelItemConfirm={(item) => {
            setCancelItemConfirm(item);
            setCancelItemQty(1);
          }}
        />
      </div>

      {/* Docked action bar — the only thing pinned when the sheet is closed.
          Opens the catalog as a bottom sheet on demand; a badge surfaces any
          in-progress cart so it's never lost behind the closed sheet. */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 sm:px-4 py-3">
        <Button onClick={() => setShowMenu(true)} className="w-full">
          <Plus className="h-4 w-4 mr-1" />
          {t('orders.addItems')}
          {cart.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-semibold">
              {cart.length}
            </span>
          )}
        </Button>
      </div>

      {/* Catalog — on-demand bottom sheet (menu grid + cart) */}
      {showMenu && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          <button
            type="button"
            aria-label={t('close', { ns: 'common' })}
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMenu(false)}
          />
          <div className="relative flex h-[88%] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl">
            <TableMenuPicker
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              filteredItems={filteredItems}
              getCartQuantity={getCartQuantity}
              addToCart={addToCart}
              taxMultiplier={taxMultiplier}
              formatPrice={formatPrice}
              cartLength={cart.length}
              onClose={() => setShowMenu(false)}
            />
            {cart.length > 0 && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t">
                <TableCart
                  cart={cart}
                  activeOrder={activeOrder}
                  selectedOrderIndex={selectedOrderIndex}
                  submitting={submitting}
                  orderNotes={orderNotes}
                  cartTotal={cartTotal}
                  formatPrice={formatPrice}
                  onAddToCart={addToCart}
                  onRemoveFromCart={removeFromCart}
                  onSetOrderNotes={setOrderNotes}
                  onSubmit={activeOrder ? handleAddItemsToOrder : handleCreateOrderWithItems}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment — opens in place on the table screen (no order-detail hop) */}
      <SplitPaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        order={activeOrder}
        onSuccess={() => {
          setShowPayment(false);
          toast.success(t('orders.paymentProcessed'));
        }}
      />

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <CancelOrderModal
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          cancelling={cancelling}
          onClose={() => {
            setShowCancelModal(false);
            setCancelReason('');
          }}
          onConfirm={handleCancelOrder}
        />
      )}

      {/* Cancel Item Confirmation with Quantity Selector */}
      {cancelItemConfirm && (
        <CancelItemModal
          cancelItemConfirm={cancelItemConfirm}
          cancelItemQty={cancelItemQty}
          setCancelItemQty={setCancelItemQty}
          cancellingItem={cancellingItem}
          onClose={() => {
            setCancelItemConfirm(null);
            setCancelItemQty(1);
          }}
          onConfirm={handleCancelItem}
        />
      )}

      {/* Item Transfer Modal */}
      {activeOrder && (
        <ItemTransferModal
          isOpen={showItemTransferModal}
          onClose={() => setShowItemTransferModal(false)}
          order={activeOrder}
          sourceTableId={tableId}
          onSuccess={() => {
            setShowItemTransferModal(false);
            toast.success(t('tables.itemsTransferred'));
          }}
        />
      )}
    </div>
  );
}
