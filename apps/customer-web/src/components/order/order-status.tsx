'use client';

import { useTranslation } from '@gustri/i18n';
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  Hourglass,
  MessageSquare,
  Minus,
  Plus,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FeedbackForm } from '@/components/feedback/feedback-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlatformFooter } from '@/components/ui/platform-footer';
import { CallStaffModal } from '@/components/waiter/call-staff-modal';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCancelOrder, useCancelOrderItem, useOrder } from '@/hooks/use-order';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { timeAgo } from '@/lib/utils';

interface OrderStatusProps {
  tableId: string; // This is the table_number from URL (e.g., "T01")
}

export function OrderStatus({ tableId }: OrderStatusProps) {
  const router = useRouter();
  const { t } = useTranslation('customer');

  // Fetch table to get the actual UUID for database operations
  const { data: table, isLoading: tableLoading } = useTable(tableId);
  const actualTableId = table?.id || '';

  const { data: order, isLoading: orderLoading } = useOrder(actualTableId);
  const { data: settings } = useCafeSettings();
  const formatPrice = useFormatPrice();

  const cancelOrder = useCancelOrder();
  const cancelItem = useCancelOrderItem();
  const [showCallStaffModal, setShowCallStaffModal] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);
  const [cancelItemModal, setCancelItemModal] = useState<{
    id: string;
    name: string;
    quantity: number;
  } | null>(null);
  const [cancelItemQty, setCancelItemQty] = useState(1);
  const [cancelLoading, setCancelLoading] = useState(false);

  const isLoading = tableLoading || orderLoading;

  const canCancel = order?.status === 'pending_approval' || order?.status === 'new';

  const handleCancelOrder = async () => {
    if (!order) return;
    setCancelLoading(true);
    try {
      await cancelOrder.mutateAsync({
        orderId: order.id,
        tableId: order.table_id,
      });
      setShowCancelOrderConfirm(false);
      router.push(`/table/${tableId}/menu`);
    } catch (error) {
      console.error('Failed to cancel order:', error);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCancelItem = async () => {
    if (!cancelItemModal) return;
    setCancelLoading(true);
    try {
      await cancelItem.mutateAsync({
        itemId: cancelItemModal.id,
        cancelQty: cancelItemQty,
      });
      setCancelItemModal(null);
      setCancelItemQty(1);
    } catch (error) {
      console.error('Failed to cancel item:', error);
    } finally {
      setCancelLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">{t('orderStatus.noOrderTitle')}</h1>
          <p className="text-muted-foreground">{t('orderStatus.noOrderSubtext')}</p>
        </div>
        <Button size="lg" onClick={() => router.push(`/table/${tableId}/menu`)}>
          {t('orderStatus.browseMenu')}
        </Button>
      </div>
    );
  }

  const statusSteps = [
    { key: 'pending_approval', label: t('orderStatus.step.awaitingApproval'), icon: Hourglass },
    { key: 'new', label: t('orderStatus.step.orderConfirmed'), icon: CheckCircle2 },
    { key: 'preparing', label: t('orderStatus.step.preparing'), icon: Clock },
    { key: 'ready', label: t('orderStatus.step.ready'), icon: CheckCircle2 },
    { key: 'served', label: t('orderStatus.step.served'), icon: CheckCircle2 },
  ];

  const currentStepIndex = statusSteps.findIndex((step) => step.key === order.status);
  // "served" is a final state — all steps are completed
  const isOrderCompleted = order.status === 'served';

  const getItemStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return t('orderStatus.itemStatus.pending');
      case 'preparing':
        return t('orderStatus.itemStatus.preparing');
      case 'ready':
        return t('orderStatus.itemStatus.ready');
      case 'served':
        return t('orderStatus.itemStatus.served');
      case 'cancelled':
        return t('orderStatus.cancelled');
      default:
        return status;
    }
  };

  const getItemBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'preparing':
        return 'bg-yellow-50 text-yellow-700 border-yellow-300';
      case 'ready':
        return 'bg-green-50 text-green-700 border-green-300';
      case 'served':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'cancelled':
        return 'bg-red-50 text-red-600 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{t('orderStatus.header')}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Order Header */}
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {t('orderStatus.labelOrderNumber')}
            </span>
            <Badge variant="outline">{order.order_number}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('orderStatus.labelTable')}</span>
            <span className="font-medium">{order.table.table_number}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-muted-foreground">{t('orderStatus.labelPlaced')}</span>
            <span className="font-medium">{timeAgo(order.created_at)}</span>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-card rounded-lg p-6 border">
          <h2 className="font-semibold mb-4">{t('orderStatus.progressTitle')}</h2>
          <div className="space-y-4">
            {statusSteps.map((step, index) => {
              const isActive = !isOrderCompleted && index === currentStepIndex;
              const isCompleted = isOrderCompleted || index < currentStepIndex;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-4">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${isActive ? 'text-primary' : ''}`}>{step.label}</p>
                    {isActive && (
                      <p className="text-sm text-muted-foreground">{t('orderStatus.inProgress')}</p>
                    )}
                  </div>
                  {isCompleted && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
              );
            })}
          </div>

          {order.status === 'pending_approval' && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-center font-medium text-amber-800 dark:text-amber-200">
                ⏳ {t('orderStatus.banner.pendingApproval')}
              </p>
              <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-1">
                {t('orderStatus.banner.pendingApprovalSub')}
              </p>
            </div>
          )}

          {order.status === 'new' && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-center font-medium text-blue-800 dark:text-blue-200">
                ✓ {t('orderStatus.banner.confirmed')}
              </p>
            </div>
          )}

          {order.status === 'preparing' && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <p className="text-sm text-center">🔥 {t('orderStatus.banner.preparing')}</p>
            </div>
          )}

          {order.status === 'ready' && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-sm text-center font-medium">✨ {t('orderStatus.banner.ready')}</p>
            </div>
          )}

          {order.status === 'served' && (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-center font-medium text-purple-800 dark:text-purple-200">
                {t('orderStatus.banner.served')}
              </p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-card rounded-lg p-4 border">
          <h2 className="font-semibold mb-4">{t('orderStatus.orderItemsTitle')}</h2>
          <div className="space-y-3">
            {order.order_items.map((item) => {
              const isCancelled = item.status === 'cancelled';
              return (
                <div
                  key={item.id}
                  className={`flex items-start justify-between pb-3 border-b last:border-0 last:pb-0 ${isCancelled ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isCancelled ? 'line-through' : ''}`}>
                        {item.quantity}x
                      </span>
                      <span className={isCancelled ? 'line-through' : ''}>{item.item_name}</span>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-1">📝 {item.notes}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getItemBadgeColor(item.status)}`}
                      >
                        {getItemStatusLabel(item.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isCancelled ? 'line-through' : ''}`}>
                      {formatPrice(item.item_price * item.quantity)}
                    </span>
                    {canCancel && !isCancelled && (
                      <button
                        onClick={() => {
                          setCancelItemModal({
                            id: item.id,
                            name: item.item_name,
                            quantity: item.quantity,
                          });
                          setCancelItemQty(item.quantity > 1 ? 1 : item.quantity);
                        }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t space-y-2">
            {order.tax > 0 ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal', { ns: 'common' })}</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {settings?.tax_label || t('orders.tax', { ns: 'staff' })}
                  </span>
                  <span>{formatPrice(order.tax)}</span>
                </div>
              </>
            ) : null}
            <div className="flex justify-between text-lg font-bold">
              <span>{t('total', { ns: 'common' })}</span>
              <span className="text-primary">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Feedback Form */}
        {showFeedbackForm && (
          <div className="bg-card rounded-lg p-6 border">
            <FeedbackForm
              tableId={actualTableId}
              orderId={order.id}
              onSuccess={() => setShowFeedbackForm(false)}
              onCancel={() => setShowFeedbackForm(false)}
            />
          </div>
        )}

        {/* Actions */}
        {!showFeedbackForm && (
          <div className="space-y-3">
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setShowCallStaffModal(true)}
            >
              <Bell className="mr-2 h-5 w-5" />
              {t('orderStatus.callStaff')}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => setShowFeedbackForm(true)}
            >
              <MessageSquare className="mr-2 h-5 w-5" />
              {t('orderStatus.sendFeedback')}
            </Button>

            {(order.status === 'pending_approval' || order.status === 'new') && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => router.push(`/table/${tableId}/menu`)}
              >
                <Plus className="mr-2 h-5 w-5" />
                {t('orderStatus.addMoreItems')}
              </Button>
            )}

            {canCancel && (
              <Button
                variant="outline"
                size="lg"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setShowCancelOrderConfirm(true)}
              >
                <Trash2 className="mr-2 h-5 w-5" />
                {t('orderStatus.cancelOrder')}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Call Staff Modal */}
      <CallStaffModal
        tableId={actualTableId}
        isOpen={showCallStaffModal}
        onClose={() => setShowCallStaffModal(false)}
      />

      {/* Cancel Order Confirmation Modal */}
      {showCancelOrderConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold">{t('orderStatus.cancelOrder')}</h3>
            </div>
            <p className="text-muted-foreground mb-6">{t('orderStatus.cancelOrderConfirm')}</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelOrderConfirm(false)}
                disabled={cancelLoading}
              >
                {t('orderStatus.keepOrder')}
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCancelOrder}
                disabled={cancelLoading}
              >
                {cancelLoading ? t('orderStatus.cancelling') : t('orderStatus.confirmCancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Item Modal */}
      {cancelItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold">{t('orderStatus.cancelItem')}</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              {t('orderStatus.cancelItemConfirm', { name: cancelItemModal.name })}
            </p>

            {cancelItemModal.quantity > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('orderStatus.cancelQuantity')}
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setCancelItemQty(Math.max(1, cancelItemQty - 1))}
                    disabled={cancelItemQty <= 1}
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-2xl font-bold w-12 text-center">{cancelItemQty}</span>
                  <button
                    onClick={() =>
                      setCancelItemQty(Math.min(cancelItemModal.quantity, cancelItemQty + 1))
                    }
                    disabled={cancelItemQty >= cancelItemModal.quantity}
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  {t('orderStatus.outOf', {
                    count: cancelItemQty,
                    total: cancelItemModal.quantity,
                  })}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCancelItemModal(null);
                  setCancelItemQty(1);
                }}
                disabled={cancelLoading}
              >
                {t('orderStatus.keepItem')}
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={handleCancelItem}
                disabled={cancelLoading}
              >
                {cancelLoading ? t('orderStatus.cancelling') : t('orderStatus.confirmCancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Footer */}
      <PlatformFooter className="pb-4" />
    </div>
  );
}
