import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const { tenant_id, title, body, data } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Get all active staff push tokens for this tenant
  const { data: staff } = await supabase
    .from('staff')
    .select('push_token')
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
    .not('push_token', 'is', null);

  if (!staff || staff.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Send via Expo Push API
  const messages = staff
    .filter((s: { push_token: string | null }) => s.push_token)
    .map((s: { push_token: string }) => ({
      to: s.push_token,
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
