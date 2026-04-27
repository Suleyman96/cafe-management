# Phase 7e Prompt: Mobile Hardening (SCALE-22 + SCALE-28 + SCALE-29 + SCALE-32 + SCALE-33 + SCALE-34)

Copy everything below the line and paste it as the prompt for a new Claude Code session.

---

## Task

Implement 6 mobile-specific items from Phase 7 of `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`. All changes are in `apps/mobile/`. Total effort: ~4 days.

Read the full plan file for context. The mobile app is an Expo/React Native staff portal with offline-first architecture, Realtime subscriptions, and local push notifications. These items harden it for 100-cafe scale.

---

## SCALE-22: Add Sentry crash reporting

### Problem
Staff-web and customer-web have `@sentry/nextjs`. The mobile app has zero crash reporting — errors are invisible in production.

### Current state
- No `@sentry/react-native` in `apps/mobile/package.json`
- No Sentry imports anywhere in `apps/mobile/src/`
- Error boundary exists at `apps/mobile/src/components/ErrorBoundary.tsx` — logs to console only (line 25)

### Implementation

**Step 1** — Install:
```bash
pnpm add @sentry/react-native --filter=@gustri/mobile
```

**Step 2** — Initialize Sentry in `apps/mobile/App.tsx`. Add before the `App` function:

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enabled: !__DEV__,
});
```

Wrap the default export at the bottom of the file:
```typescript
export default Sentry.wrap(App);
```

**Step 3** — Update ErrorBoundary at `apps/mobile/src/components/ErrorBoundary.tsx`. Replace `console.error` (line 25) with:

```typescript
import * as Sentry from '@sentry/react-native';

// In componentDidCatch:
Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
```

**Step 4** — Add `EXPO_PUBLIC_SENTRY_DSN` to environment config. Check if `apps/mobile/.env.example` or `app.json`/`app.config.ts` has env var configuration and add the DSN placeholder.

### Verification
- In dev: Sentry disabled (`enabled: !__DEV__`)
- Build a production bundle and throw a test error → appears in Sentry dashboard
- ErrorBoundary catches render errors → reported to Sentry with component stack
- Run `pnpm type-check --filter=@gustri/mobile`

---

## SCALE-28: Remote push notifications

### Problem
Notifications only work when the app is in the foreground (local notifications triggered by Realtime WebSocket). When backgrounded or killed, waiters get zero alerts.

### Current state (verified)
`apps/mobile/src/lib/notifications.ts`:
- Lines 16-67: `registerForPushNotifications()` gets Expo push token (line 49) but **never sends it to the server** (line 62 just returns the token)
- Lines 69-106: Local notification helpers exist and work
- Push token is obtained but discarded

### Implementation

**Step 1** — Add `push_token` column. Create migration `supabase/migrations/YYYYMMDD_staff_push_token.sql`:

```sql
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS push_token TEXT;
```

**Step 2** — Store the push token on login. Update `apps/mobile/src/lib/notifications.ts` to accept a callback for storing the token:

```typescript
export async function registerForPushNotifications(): Promise<string | null> {
  // ... existing permission logic (lines 16-46) stays the same

  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return pushToken.data; // Return token so caller can store it
  } catch {
    return null;
  }
}
```

The function already returns the token (line 62). Now use it in the login flow.

**Step 3** — Store the token after login. Update `apps/mobile/src/screens/auth/LoginScreen.tsx` or wherever `registerForPushNotifications` is called. Read `App.tsx` line 71 — it calls `registerForPushNotifications()` on mount. Change to:

```typescript
useEffect(() => {
  registerForPushNotifications().then(async (token) => {
    if (token && staff?.id) {
      try {
        await db.staff.update(staff.id, { push_token: token });
      } catch {
        // Non-critical — local notifications still work
      }
    }
  });
  setupSounds();
  return () => { cleanupSounds(); };
}, [staff?.id]);
```

Wait — `staff` may not be available in the same `useEffect`. Check the actual App.tsx structure. The `staff` object comes from `useAuthStore`. The push token registration should happen AFTER login, not on app mount. Read the current flow:

- `App.tsx` line 71: `registerForPushNotifications()` — fires on mount, before login
- `App.tsx` lines 52-57: `getCurrentUser()` — checks existing session

The correct place is after successful login. Either:
- Update `LoginScreen.tsx` to store token after `login()` succeeds
- Or create a separate `useEffect` in `App.tsx` that watches `staff` state and stores token when staff becomes non-null

**Recommended approach** — add to `App.tsx` a separate effect:

```typescript
// Store push token when staff is available
const staff = useAuthStore((s) => s.staff);

useEffect(() => {
  if (!staff?.id) return;

  registerForPushNotifications().then(async (token) => {
    if (token) {
      try {
        await db.staff.update(staff.id, { push_token: token });
      } catch {
        // Non-critical
      }
    }
  });
}, [staff?.id]);
```

Check that `db` is accessible at the App.tsx level. It's imported at `apps/mobile/src/lib/supabase.ts`.

**Step 4** — Create a Supabase Edge Function for sending push notifications. Create `supabase/functions/send-push/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { type, tenant_id, title, body, data } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Get all staff push tokens for this tenant
  const { data: staff } = await supabase
    .from('staff')
    .select('push_token')
    .eq('tenant_id', tenant_id)
    .eq('is_active', true)
    .not('push_token', 'is', null);

  if (!staff || staff.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  // Send via Expo Push API
  const messages = staff
    .filter((s) => s.push_token)
    .map((s) => ({
      to: s.push_token,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  const result = await response.json();
  return new Response(JSON.stringify({ sent: messages.length, result }), { status: 200 });
});
```

**Step 5** — Set up a database webhook to call this function on new orders/waiter calls. This is done in the Supabase Dashboard (Database > Webhooks), not in code. Document the setup:

```
-- Supabase Dashboard > Database > Webhooks:
-- 1. Webhook: "push-new-order"
--    Table: orders, Event: INSERT
--    URL: https://<project>.supabase.co/functions/v1/send-push
--    Headers: Authorization: Bearer <SUPABASE_ANON_KEY>
--    Payload: { type: 'new_order', tenant_id: record.tenant_id, title: 'New Order', body: 'Order #' + record.order_number }
--
-- 2. Webhook: "push-waiter-call"
--    Table: waiter_calls, Event: INSERT
--    URL: same
--    Payload: { type: 'waiter_call', tenant_id: record.tenant_id, title: 'Waiter Call', body: 'Table needs assistance' }
```

**Important**: If you don't have Supabase Edge Functions set up yet, the token storage (Steps 1-3) is still valuable — it prepares the infrastructure. The Edge Function and webhook can be added later. Focus on getting the token stored first.

### Verification
- Login on mobile → check staff record has `push_token` field populated
- If Edge Function is deployed: background the app → create order → push notification appears
- Token cleared on logout? Not necessary — token is per-device, not per-session
- Run `pnpm type-check --filter=@gustri/mobile`

---

## SCALE-29: Reduce offline cache GC time

### Problem
`OFFLINE_GC_TIME` in `apps/mobile/src/lib/query-persister.ts` line 47 is 24 hours. AsyncStorage has ~6MB limit on some Android devices. At 50 orders/day with nested items, cache can overflow.

### Current state (verified)
```typescript
// query-persister.ts line 47
export const OFFLINE_GC_TIME = 24 * 60 * 60 * 1000; // 24 hours
```

Used in `App.tsx` line 40: `gcTime: OFFLINE_GC_TIME`

### Implementation

**Step 1** — Reduce GC time in `apps/mobile/src/lib/query-persister.ts` line 47:

```typescript
export const OFFLINE_GC_TIME = 4 * 60 * 60 * 1000; // 4 hours
```

4 hours is enough for a typical shift. Cached data survives app restarts and brief offline periods but doesn't accumulate across days.

**Step 2** — That's it. The `PERSISTED_QUERY_KEYS` set (lines 14-27) already filters to only critical data. The GC time reduction prevents stale cache from growing.

### Verification
- App restarts within 4 hours → cached data available
- After 4+ hours → stale data cleaned, fresh fetch on next load
- No AsyncStorage errors on Android with moderate usage

---

## SCALE-32: Migrate FlatList to FlashList

### Problem
All 17 list screens use `FlatList`. At 50+ active orders, FlatList causes scroll jank and memory bloat.

### Current state (verified)
17 screens use FlatList — confirmed in: OrdersListScreen, TablesListScreen, KitchenDisplayScreen, WaiterCallsScreen, DeliveryListScreen, TakeoutListScreen, StockListScreen, ExpensesListScreen, WasteListScreen, TasksListScreen, SchedulesScreen, FeedbackListScreen, StaffListScreen, MenuManagementScreen, AddItemsScreen, OrderDetailScreen, TableDetailScreen.

### Implementation

**Step 1** — Install:
```bash
pnpm add @shopify/flash-list --filter=@gustri/mobile
```

**Step 2** — Migrate the 5 highest-traffic screens first (others can be done later):

Priority screens:
1. `apps/mobile/src/screens/orders/OrdersListScreen.tsx`
2. `apps/mobile/src/screens/kitchen/KitchenDisplayScreen.tsx`
3. `apps/mobile/src/screens/tables/TablesListScreen.tsx`
4. `apps/mobile/src/screens/calls/WaiterCallsScreen.tsx`
5. `apps/mobile/src/screens/delivery/DeliveryListScreen.tsx`

For each screen:

```typescript
// BEFORE:
import { FlatList } from 'react-native';

<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  refreshControl={<RefreshControl ... />}
/>

// AFTER:
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  estimatedItemSize={100}
  refreshControl={<RefreshControl ... />}
/>
```

**Key difference**: `FlashList` requires `estimatedItemSize` prop. Estimate based on the rendered card height:
- Order cards: ~120px
- Table cards: ~100px
- Kitchen items: ~80px
- Waiter call cards: ~100px
- Delivery cards: ~130px

Read each screen's `renderItem` to judge the approximate height.

**Step 3** — Leave the remaining 12 screens on `FlatList` for now. They're lower traffic (staff management, expenses, settings) and can be migrated later.

### Verification
- Open orders list with 20+ items → smooth scrolling, no jank
- Pull-to-refresh works
- Empty state renders correctly
- Kitchen display with rapid updates → no flicker
- Run `pnpm type-check --filter=@gustri/mobile`

---

## SCALE-33: Sync handler Sentry integration

### Problem
`apps/mobile/src/lib/sync-handler.ts` catches offline mutation sync failures but only logs to `console.warn` (line 25).

### Current state (verified)
```typescript
// sync-handler.ts lines 20-33
export function configureSyncErrorHandling(mutationCache: MutationCache) {
  mutationCache.subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error') {
      const error = event.action.error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[Sync] Mutation failed after reconnect:', message);
      syncErrorHandler(
        error instanceof Error ? error : new Error(message),
        'sync-mutation-failure',
      );
    }
  });
}
```

### Implementation

**Depends on SCALE-22 (Sentry).** Implement SCALE-22 first.

Update `apps/mobile/src/lib/sync-handler.ts`:

```typescript
import type { MutationCache } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';

type SyncErrorHandler = (error: Error, context: string) => void;

let syncErrorHandler: SyncErrorHandler = () => {};

export function setSyncErrorHandler(handler: SyncErrorHandler) {
  syncErrorHandler = handler;
}

export function configureSyncErrorHandling(mutationCache: MutationCache) {
  mutationCache.subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error') {
      const error = event.action.error;
      const message = error instanceof Error ? error.message : String(error);

      Sentry.captureException(
        error instanceof Error ? error : new Error(message),
        { tags: { context: 'offline-sync' } },
      );

      syncErrorHandler(
        error instanceof Error ? error : new Error(message),
        'sync-mutation-failure',
      );
    }
  });
}
```

### Verification
- Go offline → trigger a mutation → go online → if sync fails → Sentry receives error with `context: 'offline-sync'` tag
- Normal online mutations don't trigger extra Sentry events
- Run `pnpm type-check --filter=@gustri/mobile`

---

## SCALE-34: Mobile E2E tests with Maestro

### Problem
Mobile app has 24 unit tests but zero E2E tests. Critical flows (login, order viewing, waiter call) are untested on device.

### Implementation

**Step 1** — Create Maestro test directory:
```bash
mkdir -p apps/mobile/maestro
```

**Step 2** — Create login flow test at `apps/mobile/maestro/login-flow.yaml`:

```yaml
appId: com.gustri.mobile
---
- launchApp
- assertVisible: "Email"
- tapOn: "Email"
- inputText: "admin@test.com"
- tapOn: "Password"
- inputText: "test1234"
- tapOn:
    text: "Sign In"
- assertVisible:
    text: "Tables|Orders"
    timeout: 15000
```

**Step 3** — Create order viewing test at `apps/mobile/maestro/view-orders.yaml`:

```yaml
appId: com.gustri.mobile
---
- launchApp
# Login first
- tapOn: "Email"
- inputText: "admin@test.com"
- tapOn: "Password"
- inputText: "test1234"
- tapOn:
    text: "Sign In"
- assertVisible:
    text: "Tables|Orders"
    timeout: 15000

# Navigate to orders tab
- tapOn: "Orders"
- assertVisible:
    text: "Orders"
    timeout: 10000
```

**Step 4** — Create waiter call test at `apps/mobile/maestro/waiter-calls.yaml`:

```yaml
appId: com.gustri.mobile
---
- launchApp
- tapOn: "Email"
- inputText: "admin@test.com"
- tapOn: "Password"
- inputText: "test1234"
- tapOn:
    text: "Sign In"
- assertVisible:
    text: "Tables|Orders"
    timeout: 15000

# Navigate to calls tab
- tapOn: "Calls"
- assertVisible:
    text: "Waiter Calls|Calls"
    timeout: 10000
```

**Important**: These are SKELETON tests. You MUST read the actual screen components to determine the correct text labels and navigation structure. The `assertVisible` texts above (`"Email"`, `"Sign In"`, `"Tables|Orders"`) are guesses based on typical patterns. Read:
- `apps/mobile/src/screens/auth/LoginScreen.tsx` — for actual input labels and button text
- `apps/mobile/src/navigation/MainTabs.tsx` — for actual tab names
- `apps/mobile/src/navigation/DrawerNavigator.tsx` — for drawer item names

**Step 5** — Add a script to run Maestro tests. Update `apps/mobile/package.json`:

```json
"scripts": {
  "test:e2e": "maestro test maestro/"
}
```

**Note**: Maestro requires a running simulator/emulator with the app installed. These tests won't run in standard CI without a macOS runner with Xcode or Android emulator. Document this limitation.

### Verification
- Start Expo dev server
- Build and install on simulator: `expo run:ios` or `expo run:android`
- Run: `maestro test apps/mobile/maestro/login-flow.yaml`
- Test passes → login flow works end-to-end on device

---

## Execution order

These have dependencies:

1. **SCALE-22** (Sentry) — do first, SCALE-33 depends on it
2. **SCALE-29** (cache GC) — one-line change, independent
3. **SCALE-33** (sync Sentry) — depends on SCALE-22
4. **SCALE-32** (FlashList) — independent, larger change
5. **SCALE-28** (push notifications) — most complex, needs migration + Edge Function
6. **SCALE-34** (E2E tests) — do last, needs working app to test against

## General rules
- All changes are in `apps/mobile/` and `supabase/`
- Biome formatting applies to TypeScript files. Run `pnpm check:fix`
- For Maestro tests: READ actual component text before writing assertions
- For Sentry: disabled in dev mode (`enabled: !__DEV__`)
- For FlashList: only migrate 5 priority screens, leave others on FlatList
- Run `pnpm type-check --filter=@gustri/mobile` after each item
