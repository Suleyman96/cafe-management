'use client';

import { useTranslation } from '@cafe-idare/i18n';
import { ArrowLeft, Bell, CheckCircle2, Clock, Hourglass, MessageSquare, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FeedbackForm } from '@/components/feedback/feedback-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlatformFooter } from '@/components/ui/platform-footer';
import { CallStaffModal } from '@/components/waiter/call-staff-modal';
import { useOrder } from '@/hooks/use-order';
import { useCafeSettings } from '@/hooks/use-settings';
import { useTable } from '@/hooks/use-table';
import { formatPrice, getStatusColor, timeAgo } from '@/lib/utils';

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
  const [showCallStaffModal, setShowCallStaffModal] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  const isLoading = tableLoading || orderLoading;

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
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
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
        </div>

        {/* Order Items */}
        <div className="bg-card rounded-lg p-4 border">
          <h2 className="font-semibold mb-4">{t('orderStatus.orderItemsTitle')}</h2>
          <div className="space-y-3">
            {order.order_items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between pb-3 border-b last:border-0 last:pb-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.quantity}x</span>
                    <span>{item.item_name}</span>
                  </div>
                  {item.notes && (
                    <p className="text-sm text-muted-foreground mt-1">📝 {item.notes}</p>
                  )}
                  <Badge
                    variant="outline"
                    className={`mt-2 text-xs ${getStatusColor(item.status)}`}
                  >
                    {item.status}
                  </Badge>
                </div>
                <span className="font-medium">{formatPrice(item.item_price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t space-y-2">
            {settings?.tax_enabled && settings?.show_tax_separately ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal', { ns: 'common' })}</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {settings.tax_label} ({settings.tax_percentage}%)
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
          </div>
        )}
      </div>

      {/* Call Staff Modal */}
      <CallStaffModal
        tableId={actualTableId}
        isOpen={showCallStaffModal}
        onClose={() => setShowCallStaffModal(false)}
      />

      {/* Platform Footer */}
      <PlatformFooter className="pb-4" />
    </div>
  );
}
