import { createServerSupabase } from '@/lib/supabase-server';
import { DeliveryMenuContent } from './delivery-menu-content';

export default async function DeliveryMenuPage() {
  const supabase = createServerSupabase();

  const [{ data: categories }, { data: menuItems }] = await Promise.all([
    supabase.from('categories').select('*').eq('is_active', true).order('display_order'),
    supabase.from('menu_items').select('*').eq('is_available', true).order('display_order'),
  ]);

  return (
    <DeliveryMenuContent initialCategories={categories ?? []} initialMenuItems={menuItems ?? []} />
  );
}
