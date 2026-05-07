import { DeliveryMenuContent } from '@/components/menu/delivery-menu-content';

/**
 * Thin client shell. The pre-PR version SSR-fetched categories and menu
 * items via the anon Supabase client with no tenant context bound; in a
 * multi-tenant deployment that produced an SSR HTML payload that briefly
 * contained mixed-tenant items before the client guard redirected.
 *
 * The client component now resolves the bearer `qr_token` via
 * `/api/v1/customer/qr-tokens/resolve` (server-side validation against
 * `qr_tokens` + plan gate), binds the returned `tenant_id` to the
 * wrapper, and only then mounts `MenuScreen` — whose `useMenuItems` /
 * `useCategories` hooks now scope reads via `applyTenantScope`. The SSR
 * round-trip is intentionally gone; the perf hit on initial paint is
 * bounded by the single token-resolve POST and is acceptable for a
 * page that already requires client-side state (`useDeliveryStore`).
 */
export default function DeliveryMenuPage() {
  return <DeliveryMenuContent />;
}
