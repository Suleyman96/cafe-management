import { DeliveryOrderStatus } from '@/components/order/delivery-order-status';

interface PageProps {
  params: {
    orderId: string;
  };
  searchParams: {
    token?: string;
  };
}

export default function DeliveryOrderPage({ params, searchParams }: PageProps) {
  return <DeliveryOrderStatus orderId={params.orderId} accessToken={searchParams.token ?? ''} />;
}
