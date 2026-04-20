import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server';
import StockClient from './stock-client';

export default async function StockPage() {
  const supabase = createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: staff } = (await supabase
    .from('staff')
    .select('role')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()) as { data: { role: string } | null };

  if (!staff || !['admin', 'owner'].includes(staff.role)) {
    redirect('/orders');
  }

  return <StockClient />;
}
