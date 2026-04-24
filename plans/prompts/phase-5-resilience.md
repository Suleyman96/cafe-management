# Phase 5 Prompt: Resilience (SCALE-11 + SCALE-12)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement Phase 5 (SCALE-11 and SCALE-12) from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. Read that file for full context, but this prompt contains the verified details you need. Phases 1-4 have already been implemented.

## What you're fixing and why

At 100 cafes with 300+ concurrent staff, network failures are guaranteed. The app must handle them gracefully instead of silently breaking:

1. **Notification subscriptions have no error recovery** — if the WebSocket drops, staff stop getting audio alerts for new orders. The data-sync hook (`useRealtimeSync`) has retry + polling fallback, but the notification provider does NOT. In a restaurant, missing an order notification during a rush is a real operational problem.

2. **No global connection health indicator** — if Supabase goes down, every component independently errors with scattered error states. There's no unified "we're having trouble" banner and no way to disable mutations (which would fail and confuse users).

---

## SCALE-11: Notification subscription fallback with retry and polling

### Goal
Add exponential backoff retry and fallback polling to the notification provider's three Realtime subscriptions, matching the pattern already established in `useRealtimeSync`. Also show a visual indicator when realtime is degraded.

### Current state (verified)

**NotificationProvider** (`apps/staff-web/src/components/providers/notification-provider.tsx`) has three subscriptions:

1. **Waiter calls** (lines 159-189): `supabase.channel('notify-waiter-calls')` subscribing to `waiter_calls` table
2. **Orders** (lines 191-239): `supabase.channel('notify-orders')` subscribing to `orders` table
3. **Order items** (lines 241-271): `supabase.channel('notify-order-items')` subscribing to `order_items` table

All three have the **same problem** in their `.subscribe()` callback:

```typescript
.subscribe((status) => {
  Sentry.addBreadcrumb({ category: 'realtime', message: `waiter_calls channel: ${status}` });
  // NO error recovery — if status is CHANNEL_ERROR or TIMED_OUT, nothing happens
});
```

Compare with `useRealtimeSync` (`apps/staff-web/src/hooks/use-realtime-sync.ts` lines 72-93) which DOES handle errors:
- Detects `CHANNEL_ERROR` and `TIMED_OUT` statuses
- Removes the failed channel
- Retries with exponential backoff (1s, 2s, 4s... up to 30s)
- Gives up after `MAX_RETRIES` (10 attempts)
- Falls back to polling every 120s via `REFRESH_INTERVALS.FALLBACK`

**Key constants** already available in `@gustri/core`:
```typescript
REFRESH_INTERVALS.FALLBACK = 120000  // 2 minutes
```

**The NotificationProvider is mounted** in the staff layout at `apps/staff-web/src/app/(staff)/layout.tsx` lines 42-88, wrapping all staff pages. It stays mounted for the entire session.

**Current component exports**: The provider renders `children` plus a floating audio toggle button (lines 273-301). It tracks `audioEnabled` state and uses three `useEffect` hooks for the three subscriptions.

### Implementation steps

**Step 1** — Add retry state to the NotificationProvider. Add refs at the top of the component (near line 31):

```typescript
const retryCountRef = useRef(0);
const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [realtimeConnected, setRealtimeConnected] = useState(true);
```

**Step 2** — Extract a reusable subscription setup function. Currently the three `useEffect` hooks (lines 159-189, 191-239, 241-271) each create a channel independently. Refactor into a single `useEffect` that creates one multiplexed channel with all three table subscriptions:

```typescript
useEffect(() => {
  if (!tenantId) return;

  let currentChannel: RealtimeChannel | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function setupChannel() {
    const channel = supabase
      .channel('notify-all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            playSound(waiterCallAudioRef.current);
            toast.info(t('notifications.newStaffCall'), {
              description: t('notifications.tableNeedsAssistance'),
              duration: 5000,
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as OrderRow;
            if (newOrder.status === 'pending_approval') {
              playSound(notificationAudioRef.current);
              toast.info(t('notifications.newQrOrder'), {
                description: t('notifications.qrOrderDescription'),
                duration: 5000,
              });
            } else {
              playSound(orderAudioRef.current);
              toast.info(t('notifications.newOrder'), {
                description: t('notifications.newOrderDescription'),
                duration: 3000,
              });
            }
          }
          if (payload.eventType === 'UPDATE') {
            const newOrder = payload.new as OrderRow;
            const oldOrder = payload.old as Partial<OrderRow>;
            if (newOrder.status === 'ready' && oldOrder.status !== 'ready') {
              playSound(notificationAudioRef.current);
              toast.success(t('notifications.orderReady'), {
                description: t('notifications.orderReadyDescription'),
                duration: 5000,
              });
            }
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            playSound(orderAudioRef.current);
            toast.info(t('notifications.newItemsAdded'), {
              description: t('notifications.itemsAddedDescription'),
              duration: 3000,
            });
          }
        },
      )
      .subscribe((status) => {
        Sentry.addBreadcrumb({ category: 'realtime', message: `notifications channel: ${status}` });

        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0;
          setRealtimeConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeConnected(false);
          supabase.removeChannel(channel);

          if (retryCountRef.current >= 10) {
            Sentry.captureMessage('Notification realtime: max retries exceeded, falling back to polling', 'warning');
            return;
          }

          const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
          retryCountRef.current++;
          retryTimer = setTimeout(() => {
            setupChannel();
          }, delay);
        }
      });

    currentChannel = channel;
  }

  setupChannel();

  return () => {
    if (retryTimer) clearTimeout(retryTimer);
    if (currentChannel) supabase.removeChannel(currentChannel);
  };
}, [playSound, t, tenantId]);
```

**Architectural note**: Consolidating three channels into one is better for performance (fewer WebSocket connections) and simpler for retry logic. Supabase supports multiplexing multiple table subscriptions on a single channel.

**Step 3** — Add fallback polling for notifications. When realtime is disconnected, poll for recent waiter calls and orders that may have been missed:

```typescript
// Fallback poll when realtime is down
useEffect(() => {
  if (realtimeConnected) return;

  const lastCheckRef = { current: new Date().toISOString() };

  const pollInterval = setInterval(async () => {
    try {
      // Check for new waiter calls since last check
      const { data: newCalls } = await supabase
        .from('waiter_calls')
        .select('id')
        .eq('tenant_id', tenantId)
        .gt('created_at', lastCheckRef.current)
        .eq('status', 'pending')
        .limit(1);

      if (newCalls && newCalls.length > 0) {
        playSound(waiterCallAudioRef.current);
        toast.info(t('notifications.newStaffCall'), {
          description: t('notifications.tableNeedsAssistance'),
          duration: 5000,
        });
      }

      // Check for new orders since last check
      const { data: newOrders } = await supabase
        .from('orders')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .gt('created_at', lastCheckRef.current)
        .limit(5);

      if (newOrders && newOrders.length > 0) {
        playSound(orderAudioRef.current);
        toast.info(t('notifications.newOrder'), {
          description: t('notifications.newOrderDescription'),
          duration: 3000,
        });
      }

      lastCheckRef.current = new Date().toISOString();
    } catch (err) {
      Sentry.captureException(err, { tags: { context: 'notification-polling' } });
    }
  }, 120000); // 2 minutes — matches REFRESH_INTERVALS.FALLBACK

  return () => clearInterval(pollInterval);
}, [realtimeConnected, tenantId, playSound, t]);
```

**Important**: The fallback poll queries use the anon Supabase client which goes through RLS. The `tenant_id` filter is explicit as a safety measure, but RLS already scopes it. These queries are lightweight (LIMIT 1/5, indexed columns).

**Step 4** — Add a visual indicator when realtime is degraded. Add a small banner near the existing audio toggle button (around line 278):

```typescript
{/* Realtime degraded indicator */}
{!realtimeConnected && (
  <div className="fixed bottom-16 right-4 z-50 bg-amber-100 text-amber-800 text-xs px-3 py-2 rounded-lg shadow-md border border-amber-200">
    {t('notifications.realtimeDegraded', 'Live updates paused — checking periodically')}
  </div>
)}
```

Position it above the existing audio toggle button (`fixed bottom-4 right-4`), so use `bottom-16` or similar spacing.

**Step 5** — Add the `RealtimeChannel` type import at the top of the file:

```typescript
import type { RealtimeChannel } from '@supabase/supabase-js';
```

### What NOT to change

- Do NOT modify `useRealtimeSync` — it already works correctly for data sync
- Do NOT change the audio unlock logic (lines 57-109) — it handles browser autoplay restrictions
- Do NOT change the toggle button behavior (lines 132-157)
- Keep all Sentry breadcrumbs — they're useful for debugging realtime issues

### Verification
- Open staff dashboard → verify realtime connected (no amber banner)
- Block WebSocket in DevTools (Network tab → filter WS → block) → verify:
  - Amber banner appears after retry attempts
  - Polling starts (check Network tab for periodic REST queries every 2 min)
  - Sound still plays when polling detects new orders
- Unblock WebSocket → verify:
  - Banner disappears
  - Realtime resumes
  - Polling stops
- Run `pnpm test && pnpm type-check && pnpm check`

---

## SCALE-12: Circuit breaker and global connection status

### Goal
Create a connection health provider that tracks consecutive API failures across the app and shows a unified banner when the app is degraded or disconnected. When disconnected, disable mutation buttons to prevent silent failures.

### Current state (verified)

**No connection provider exists** — confirmed by searching for `ConnectionProvider`, `connection-provider`, `useConnection` in the codebase.

**Current providers** (`apps/staff-web/src/app/(staff)/layout.tsx` lines 40-88):
```typescript
<ProtectedRoute>
  <NotificationProvider>
    <div className="flex min-h-screen bg-gray-50">
      {/* sidebar + content */}
    </div>
  </NotificationProvider>
</ProtectedRoute>
```

**React Query config** (`apps/staff-web/src/app/providers.tsx` lines 36-58):
- `QueryClient` with `MutationCache` (for global error handler from Phase 2)
- `retry: 1` for queries
- Global error handler shows toast + Sentry on unhandled mutation errors

**Sonner toast** is available globally (`<Toaster position="bottom-right" />` in providers.tsx line 67).

**Sentry** is imported in providers.tsx.

### Implementation steps

**Step 1** — Create `apps/staff-web/src/components/providers/connection-provider.tsx`:

```typescript
'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

type ConnectionStatus = 'connected' | 'degraded' | 'disconnected';

const ConnectionContext = createContext<ConnectionStatus>('connected');

export function useConnectionStatus() {
  return useContext(ConnectionContext);
}

const DEGRADED_THRESHOLD = 3;  // 3 consecutive failures
const DISCONNECTED_THRESHOLD = 6; // 6 consecutive failures
const DECAY_ON_SUCCESS = 2;  // subtract 2 on each success (faster recovery)

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>('connected');
  const failureCount = useRef(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event) return;

      // Only track fetch-related state changes, not cache reads
      if (event.type !== 'updated') return;
      const queryState = event.query.state;

      if (queryState.status === 'error') {
        failureCount.current++;
        if (failureCount.current >= DISCONNECTED_THRESHOLD) {
          setStatus('disconnected');
        } else if (failureCount.current >= DEGRADED_THRESHOLD) {
          setStatus('degraded');
        }
      }

      if (queryState.status === 'success') {
        failureCount.current = Math.max(0, failureCount.current - DECAY_ON_SUCCESS);
        if (failureCount.current === 0) {
          setStatus('connected');
        } else if (failureCount.current < DEGRADED_THRESHOLD) {
          setStatus('connected');
        }
      }
    });

    return () => unsubscribe();
  }, [queryClient]);

  return (
    <ConnectionContext.Provider value={status}>
      {status !== 'connected' && <ConnectionBanner status={status} />}
      {children}
    </ConnectionContext.Provider>
  );
}

function ConnectionBanner({ status }: { status: 'degraded' | 'disconnected' }) {
  const isDegraded = status === 'degraded';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] px-4 py-2 text-center text-sm font-medium ${
        isDegraded
          ? 'bg-amber-50 text-amber-800 border-b border-amber-200'
          : 'bg-red-50 text-red-800 border-b border-red-200'
      }`}
    >
      {isDegraded
        ? 'Some features may be slow. Retrying...'
        : 'Connection lost. Changes may not be saved.'}
    </div>
  );
}
```

**Design decisions:**
- **z-index 60**: Higher than the sidebar (z-40) and notification button (z-50) so the banner is always visible
- **Decay on success**: Each successful query subtracts 2 from the failure counter, so recovery is faster than degradation. This prevents a single transient error from keeping the banner visible.
- **Thresholds**: 3 failures = degraded (brief network hiccup), 6 = disconnected (sustained outage). These are conservative — a typical page load fires 3-5 queries, so one failed page load shows "degraded", two consecutive shows "disconnected".

**Step 2** — Add the ConnectionProvider to the layout. Update `apps/staff-web/src/app/(staff)/layout.tsx`:

```typescript
import { ConnectionProvider } from '@/components/providers/connection-provider';
```

Wrap inside the existing structure. The ConnectionProvider needs access to QueryClient, so it must be INSIDE the `QueryClientProvider` (which is in providers.tsx wrapping the entire app). The staff layout is already inside `Providers`, so this works:

```typescript
return (
  <ProtectedRoute>
    <ConnectionProvider>
      <NotificationProvider>
        <div className="flex min-h-screen bg-gray-50">
          {/* ... existing layout ... */}
        </div>
      </NotificationProvider>
    </ConnectionProvider>
  </ProtectedRoute>
);
```

**Step 3** — Create a hook to disable mutations when disconnected. Create `apps/staff-web/src/hooks/use-can-mutate.ts`:

```typescript
import { useConnectionStatus } from '@/components/providers/connection-provider';

/**
 * Returns false when the app is disconnected from the backend.
 * Use this to disable action buttons that would trigger mutations.
 */
export function useCanMutate(): boolean {
  const status = useConnectionStatus();
  return status !== 'disconnected';
}
```

**Step 4** — Use `useCanMutate` in the most critical mutation buttons. Do NOT blanket-apply this to every button in the app — just the high-risk ones where a silent failure would cause confusion:

Priority buttons to protect:
- Payment processing button in order detail / split payment modal
- Order status update buttons
- Order creation

Example usage (do NOT implement all of these — just show the pattern for 1-2 key places):

```typescript
const canMutate = useCanMutate();

<Button
  onClick={handlePayment}
  disabled={!canMutate || isProcessing}
>
  {canMutate ? 'Process Payment' : 'Connection lost...'}
</Button>
```

**Do NOT** apply `useCanMutate` everywhere — it would be over-engineering. The global mutation error handler (from Phase 2) already catches and toasts failed mutations. The `useCanMutate` hook is a UX enhancement for the handful of buttons where a user might repeatedly tap and get confused by failures.

Leave the hook available for future use — other developers can adopt it gradually.

**Step 5** — Handle the banner offset for mobile. The staff layout has a mobile header (`fixed top-0` at line 45). When the connection banner is showing, the mobile header needs to shift down. The simplest approach:

```typescript
// In ConnectionBanner, add a class to push content down
// The banner is fixed top-0, same as mobile header
// Use a small banner height (py-2 = ~36px)
```

Actually, since the banner has `z-[60]` and the mobile header has `z-40`, the banner will overlay on top. This is acceptable — the banner is small (one line) and temporary. When the connection recovers, it disappears. Do NOT add complex layout shifting logic.

### What NOT to change

- Do NOT modify the `MutationCache` error handler in providers.tsx — it already handles individual mutation errors
- Do NOT add retry logic to this provider — React Query's built-in `retry: 1` handles that
- Do NOT track mutation failures in the connection provider — only track query (read) failures. Write failures are already handled by the MutationCache
- Do NOT modify `useRealtimeSync` — its own retry/fallback logic is independent

### Verification
- Normal usage → no banner visible, `useCanMutate()` returns true
- Stop Supabase locally (`supabase stop`) → after a few failed queries:
  - Amber "degraded" banner appears first
  - Red "disconnected" banner appears after sustained failures
  - `useCanMutate()` returns false (if you wired it to any buttons)
- Start Supabase again (`supabase start`) → verify:
  - Banner disappears after a few successful queries
  - Mutations work again
- Verify the banner doesn't interfere with sidebar or navigation
- Run `pnpm test && pnpm type-check && pnpm check`

---

## General rules

- Follow existing code patterns exactly — look at how NotificationProvider and useRealtimeSync are structured
- Use Biome formatting: 2-space indent, single quotes, trailing commas. Run `pnpm check:fix` before considering done
- Keep the changes minimal — SCALE-11 is modifying an existing file, SCALE-12 is creating new files + a small layout change
- The notification provider refactor (consolidating 3 channels into 1) is the biggest change — test it carefully. Make sure all three notification types (waiter call, new order, order ready) still fire correctly with their correct sounds
- Do NOT add i18n keys for the connection banner text unless translation files are easy to update — hardcoded English strings are fine for now
- Do NOT refactor surrounding code — only change what's needed for these two issues
- Run `pnpm test && pnpm type-check && pnpm check` at the end to verify everything passes
