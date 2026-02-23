import { DeliveryOrderStatus } from '@/components/order/delivery-order-status';

interface PageProps {
  params: {
    orderId: string;
  };
}

export default function DeliveryOrderPage({ params }: PageProps) {
  return <DeliveryOrderStatus orderId={params.orderId} />;
}
