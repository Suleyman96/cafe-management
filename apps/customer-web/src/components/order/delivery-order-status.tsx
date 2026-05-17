'use client';

import { useTranslation } from '@gustri/i18n';
import { Badge, LoadingSpinner } from '@gustri/ui-web';
import { CheckCircle2, Clock, Hourglass, MapPin, Phone, Truck, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OrderTimeline } from '@/components/order/order-timeline';
import { PlatformFooter } from '@/components/ui/platform-footer';
import { useDeliveryOrder } from '@/hooks/use-delivery';
import { useFormatPrice } from '@/hooks/use-format-price';
import { useCafeSettings } from '@/hooks/use-settings';
import { getStatusColor, timeAgo } from '@/lib/utils';

interface DeliveryOrderStatusProps {
  orderId: string;
}

/**
 * Read the access token out of the URL fragment (M1). The fragment is
 * `#token=<value>` (no other keys today, but parse defensively as a
 * URLSearchParams-style string so a future second key wouldn't break
 * this).
 */
function readAccessTokenFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return params.get('token');
}

export function DeliveryOrderStatus({ orderId }: DeliveryOrderStatusProps) {
  const { t } = useTranslation('customer');
  // The fragment is only available client-side, so we start with `null`
  // and read on mount. Until then we render LoadingSpinner; flashing
  // the "missing token" UI for a tick on every page-load would look
  // broken to the customer.
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    setAccessToken(readAccessTokenFromHash());
    setTokenChecked(true);
  }, []);

  const { data: order, isLoading } = useDeliveryOrder(orderId, accessToken ?? undefined);
  const { data: settings } = useCafeSettings();
  const formatPrice = useFormatPrice();

  if (!tokenChecked || isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t('deliveryStatus.notFoundTitle')}</h1>
          <p className="text-muted-foreground">{t('deliveryStatus.missingAccessToken')}</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">{t('deliveryStatus.notFoundTitle')}</h1>
          <p className="text-muted-foreground">{t('deliveryStatus.notFoundSubtext')}</p>
        </div>
      </div>
    );
  }

  const statusSteps = [
    { key: 'pending_approval', label: t('deliveryStatus.step.awaitingApproval'), icon: Hourglass },
    { key: 'new', label: t('deliveryStatus.step.orderConfirmed'), icon: CheckCircle2 },
    { key: 'preparing', label: t('deliveryStatus.step.preparing'), icon: Clock },
    { key: 'ready', label: t('deliveryStatus.step.readyForPickup'), icon: CheckCircle2 },
    { key: 'out_for_delivery', label: t('deliveryStatus.step.outForDelivery'), icon: Truck },
    { key: 'delivered', label: t('deliveryStatus.step.delivered'), icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-4 space-y-6">
        {/* Order Header */}
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {t('deliveryStatus.labelOrderNumber')}
            </span>
            <Badge variant="outline">{order.order_number}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('deliveryStatus.labelType')}</span>
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              <Truck className="h-3 w-3 mr-1" />
              {t('deliveryStatus.badgeDelivery')}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm text-muted-foreground">{t('deliveryStatus.labelPlaced')}</span>
            <span className="font-medium">
              {order.created_at ? timeAgo(order.created_at, t) : '—'}
            </span>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="bg-card rounded-lg p-4 border">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {t('deliveryStatus.deliveryDetails')}
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{order.customer_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{order.customer_phone}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <span>{order.delivery_address}</span>
            </div>
            {order.delivery_notes && (
              <p className="text-muted-foreground pl-5">{order.delivery_notes}</p>
            )}
            {order.delivery_person?.full_name && (
              <div className="flex items-center gap-2 pt-2 border-t mt-2">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  {t('deliveryStatus.driver', {
                    name: order.delivery_person.full_name,
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-card rounded-lg p-6 border">
          <h2 className="font-semibold mb-4">{t('deliveryStatus.progressTitle')}</h2>
          <OrderTimeline
            steps={statusSteps}
            currentStatus={order.status}
            inProgressLabel={t('deliveryStatus.inProgress')}
          />

          {order.status === 'pending_approval' && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-center font-medium text-amber-800 dark:text-amber-200">
                {t('deliveryStatus.banner.pendingApproval')}
              </p>
            </div>
          )}

          {order.status === 'out_for_delivery' && (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="text-sm text-center font-medium text-purple-800 dark:text-purple-200">
                {t('deliveryStatus.banner.outForDelivery')}
              </p>
            </div>
          )}

          {order.status === 'delivered' && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-center font-medium text-green-800 dark:text-green-200">
                {t('deliveryStatus.banner.delivered')}
              </p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-card rounded-lg p-4 border">
          <h2 className="font-semibold mb-4">{t('deliveryStatus.orderItemsTitle')}</h2>
          <div className="space-y-3">
            {order.order_items?.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between pb-3 border-b last:border-0 last:pb-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.quantity}x</span>
                    <span>{item.item_name}</span>
                  </div>
                  {item.notes && <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>}
                  <Badge
                    variant="outline"
                    className={`mt-2 text-xs ${getStatusColor(item.status)}`}
                  >
                    {t(`orderStatus.itemStatus.${item.status}`, { defaultValue: item.status })}
                  </Badge>
                </div>
                <span className="font-medium">{formatPrice(item.item_price * item.quantity)}</span>
              </div>
            ))}
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
            {(order.delivery_fee ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('deliveryFee', { ns: 'common' })}</span>
                <span>{formatPrice(order.delivery_fee ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold">
              <span>{t('total', { ns: 'common' })}</span>
              <span className="text-primary">{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <PlatformFooter className="pb-4" />
    </div>
  );
}
