'use client';

import { useTranslation } from '@gustri/i18n';
import { CreditCard, FileText, Map as MapIcon, MapPin, Phone, Truck, User } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryInfoProps {
  order: {
    id: string;
    status: string;
    delivery_address?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    delivery_notes?: string | null;
    delivery_fee: number;
    delivery_person_id?: string | null;
    delivery_person?: { full_name: string } | null;
  };
  staffList: any[] | undefined;
  onAssignDriver: (params: { orderId: string; staffId: string }) => Promise<any>;
  onRefetch: () => void;
  formatPrice: (amount: number) => string;
}

export function OrderDetailDelivery({
  order,
  staffList,
  onAssignDriver,
  onRefetch,
  formatPrice,
}: DeliveryInfoProps) {
  const { t } = useTranslation('staff');

  return (
    <div className="bg-purple-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 border border-purple-200">
      <h3 className="font-semibold mb-3 flex items-center gap-2 text-purple-800">
        <Truck className="h-4 w-4" />
        {t('orders.deliveryInformation')}
      </h3>
      <div className="space-y-2 text-sm">
        {order.delivery_address && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <span className="flex-1">{order.delivery_address}</span>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-purple-500 hover:text-purple-800 transition-colors"
              title={t('delivery.openInMaps')}
            >
              <MapIcon className="h-4 w-4" />
            </a>
          </div>
        )}
        {order.customer_name && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <span>{order.customer_name}</span>
          </div>
        )}
        {order.customer_phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <a href={`tel:${order.customer_phone}`} className="text-blue-600 underline">
              {order.customer_phone}
            </a>
          </div>
        )}
        {order.delivery_notes && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <span className="text-gray-600">{order.delivery_notes}</span>
          </div>
        )}
        {order.delivery_fee > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-purple-200">
            <CreditCard className="h-4 w-4 text-purple-500 flex-shrink-0" />
            <span>
              {t('deliveryFee', { ns: 'common' })}:{' '}
              <strong>{formatPrice(order.delivery_fee)}</strong>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-2 border-t border-purple-200">
          <Truck className="h-4 w-4 text-purple-500 flex-shrink-0" />
          <span className="text-sm">{t('delivery.driver')}</span>
          {['delivered', 'cancelled'].includes(order.status) ? (
            <span className="font-medium">
              {order.delivery_person?.full_name || t('orders.notAssigned')}
            </span>
          ) : (
            <select
              className="flex-1 px-2 py-1 border border-purple-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={order.delivery_person_id || ''}
              onChange={async (e) => {
                const staffId = e.target.value;
                if (!staffId) return;
                try {
                  await onAssignDriver({ orderId: order.id, staffId });
                  toast.success(t('orders.deliveryPersonAssigned'));
                  onRefetch();
                } catch {
                  toast.error(t('orders.failedAssignDriver'));
                }
              }}
            >
              <option value="">{t('orders.selectDriver')}</option>
              {staffList?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
