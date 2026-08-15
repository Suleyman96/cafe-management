import { getSupabaseAdmin } from '@/lib/api/verify-admin';
import { CafeLoginForm } from './cafe-login-form';
import { CafeNotFound } from './cafe-not-found';

export const dynamic = 'force-dynamic';

/**
 * Cafe-scoped login landing: /c/{slug}. Resolves the cafe name server-side (so
 * staff see which cafe they're signing into), then renders the client form.
 * The form's sign-in resolves (cafe, username) → account, so the same username
 * at different cafes stays separate.
 */
export default async function CafeLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: tenant } = await getSupabaseAdmin()
    .from('tenants')
    .select('name, is_active')
    .eq('slug', slug)
    .maybeSingle();

  if (!tenant || tenant.is_active === false) {
    return <CafeNotFound />;
  }

  return <CafeLoginForm slug={slug} cafeName={tenant.name} />;
}
