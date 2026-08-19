import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // `roles` (optional) restricts recipients to the given staff roles — e.g.
  // kitchen for new orders, waiters for calls. Omitted/empty ⇒ all active
  // staff (backward-compatible). Owner/admin are always included by the caller
  // as a safety net so a solo owner-on-shift never misses an alert.
  const { tenant_id, title, body, data, roles } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Pull device tokens via the normalized table, scoped by the join to
  // `staff` so a token can only be addressed under its current owner's
  // tenant — even though `staff_push_tokens` already carries tenant_id,
  // joining to `staff` defends against any future drift between the two
  // (e.g. if a staff row is moved between tenants).
  let query = supabase
    .from('staff_push_tokens')
    .select('expo_token, staff:staff!inner(id, tenant_id, is_active, role)')
    .eq('staff.tenant_id', tenant_id)
    .eq('staff.is_active', true);

  if (Array.isArray(roles) && roles.length > 0) {
    query = query.in('staff.role', roles);
  }

  const { data: rows, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const messages = rows.map((r: { expo_token: string }) => ({
    to: r.expo_token,
    title,
    body,
    data,
    sound: 'default',
    priority: 'high' as const,
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  const result = await response.json();
  return new Response(JSON.stringify({ sent: messages.length, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
