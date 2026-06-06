'use client';

import { useTranslation } from '@gustri/i18n';
import { Button, LoadingSpinner } from '@gustri/ui-web';
import { Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ItemTransferModal } from '@/components/modals/item-transfer-modal';
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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header + Order Info */}
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
        cartLength={cart.length}
        onResolveCalls={handleResolveCalls}
        onShowItemTransfer={() => setShowItemTransferModal(true)}
        onShowCancelModal={() => setShowCancelModal(true)}
        onStatusUpdate={handleStatusUpdate}
        onItemStatusUpdate={handleItemStatusUpdate}
        onCancelItemConfirm={(item) => {
          setCancelItemConfirm(item);
          setCancelItemQty(1);
        }}
      />

      {/* Menu — categories sidebar + items grid */}
      {showMenu ? (
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
      ) : (
        <div className="flex-shrink-0 px-3 sm:px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => setShowMenu(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {t('orders.addItems')}
          </Button>
        </div>
      )}

      {/* Cart — bottom half */}
      {cart.length > 0 && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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
