'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MenuScreen } from '@/components/menu/menu-screen';
import { useDeliveryStore } from '@/store/delivery-store';
import type { Category, MenuItemWithCategory } from '@/types';

interface DeliveryMenuContentProps {
  initialCategories: Category[];
  initialMenuItems: MenuItemWithCategory[];
}

export function DeliveryMenuContent({
  initialCategories,
  initialMenuItems,
}: DeliveryMenuContentProps) {
  const router = useRouter();
  const { customerName, deliveryAddress } = useDeliveryStore();

  useEffect(() => {
    if (!customerName || !deliveryAddress) {
      router.replace('/delivery');
    }
  }, [customerName, deliveryAddress, router]);

  if (!customerName || !deliveryAddress) return null;

  return (
    <MenuScreen
      tableId="__delivery__"
      initialCategories={initialCategories}
      initialMenuItems={initialMenuItems}
    />
  );
}
