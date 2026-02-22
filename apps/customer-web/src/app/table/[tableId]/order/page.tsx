import { OrderStatus } from '@/components/order/order-status';

interface PageProps {
  params: {
    tableId: string;
  };
}

export default function OrderPage({ params }: PageProps) {
  return <OrderStatus tableId={params.tableId} />;
}
