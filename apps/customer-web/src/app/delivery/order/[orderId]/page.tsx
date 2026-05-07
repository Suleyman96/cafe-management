import { DeliveryOrderStatus } from '@/components/order/delivery-order-status';

interface PageProps {
  params: {
    orderId: string;
  };
}

// M1: the delivery access token is no longer accepted via `?token=`.
// It now lives in the URL fragment (`#token=…`), which means:
//   - The server never sees it (fragments aren't sent in HTTP requests).
//   - It doesn't leak in Referer headers when the customer clicks an
//     outbound link (e.g. a tracking number to a courier site).
//   - It still survives copy/paste of the URL and browser history.
// `DeliveryOrderStatus` reads the hash on mount.
export default function DeliveryOrderPage({ params }: PageProps) {
  return <DeliveryOrderStatus orderId={params.orderId} />;
}
