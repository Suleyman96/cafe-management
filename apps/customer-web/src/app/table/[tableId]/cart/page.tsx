import { CartScreen } from '@/components/cart/cart-screen';

interface PageProps {
  params: {
    tableId: string;
  };
}

export default function CartPage({ params }: PageProps) {
  return <CartScreen tableId={params.tableId} />;
}
