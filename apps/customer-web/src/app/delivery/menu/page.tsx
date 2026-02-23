'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MenuScreen } from '@/components/menu/menu-screen';
import { useDeliveryStore } from '@/store/delivery-store';

export default function DeliveryMenuPage() {
  const router = useRouter();
  const { customerName, deliveryAddress } = useDeliveryStore();

  // Redirect to delivery landing if customer info not filled
  useEffect(() => {
    if (!customerName || !deliveryAddress) {
      router.replace('/delivery');
    }
  }, [customerName, deliveryAddress, router]);

  if (!customerName || !deliveryAddress) return null;

  return <MenuScreen tableId="__delivery__" />;
}
