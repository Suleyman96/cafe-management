import { createSupabaseWrapper } from '@gustri/api-client';
import { DeliveryMenuContent } from '@/components/menu/delivery-menu-content';
import { createServerSupabase } from '@/lib/supabase-server';

export default async function DeliveryMenuPage() {
  const supabase = createServerSupabase();
  const db = createSupabaseWrapper(supabase);

  const [categories, menuItems] = await Promise.all([
    db.categories.findAll({ isActive: true }),
    db.menuItems.findAll({ isAvailable: true }),
  ]);

  return (
    <DeliveryMenuContent initialCategories={categories ?? []} initialMenuItems={menuItems ?? []} />
  );
}
