# Phase 17B: File Organization — Reduce Navigation Boilerplate and Clean Up Redundant Re-Exports

## Goal

Fix two structural issues:
1. Mobile has 15 near-identical single-screen navigation stack files — reduce boilerplate with a factory
2. `packages/api-client/src/index.ts` redundantly re-exports 44 types already available from `@gustri/database`

## Important

- Read each file before editing
- Run `pnpm type-check` after each step
- Navigation changes are high-risk for mobile — test on simulator
- Re-export cleanup may break imports — TypeScript will catch them

---

## Step 1: Create a Stack Factory for Single-Screen Navigation

**File:** Create `apps/mobile/src/navigation/create-simple-stack.tsx`

Read 2-3 existing single-screen stacks (e.g., `CallsStack.tsx`, `WasteStack.tsx`, `ReportsStack.tsx`) to understand the exact pattern. They all follow:

```typescript
import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from './DrawerMenuButton'; // or wherever it's imported from
import XxxScreen from '@/screens/xxx/XxxScreen';

type XxxStackParamList = { XxxScreen: undefined };
const Stack = createStackNavigator<XxxStackParamList>();

export function XxxStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="XxxScreen"
        component={XxxScreen}
        options={{ title: 'Xxx', headerLeft: () => <DrawerMenuButton /> }}
      />
    </Stack.Navigator>
  );
}
```

Create a factory:

```typescript
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Read the existing stacks to find where DrawerMenuButton is imported from
// and what screenOptions are common

interface SimpleStackConfig {
  name: string;
  component: React.ComponentType<any>;
  title: string;
}

export function createSimpleStack({ name, component, title }: SimpleStackConfig) {
  type ParamList = Record<string, undefined>;
  const Stack = createStackNavigator<ParamList>();

  function SimpleStack() {
    return (
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        <Stack.Screen
          name={name}
          component={component}
          options={{
            title,
            headerLeft: () => <DrawerMenuButton />,
          }}
        />
      </Stack.Navigator>
    );
  }

  SimpleStack.displayName = `${name}Stack`;
  return SimpleStack;
}
```

Read the existing stacks carefully — some may have custom `screenOptions`, header styles, or other overrides. The factory should cover the common case. Stacks with customizations should stay as manual files.

---

## Step 2: Replace Single-Screen Stacks with Factory Calls

For each of the 15 single-screen stacks, read the file and compare to the factory pattern. If it matches exactly (no custom options beyond title and DrawerMenuButton), replace it.

### Candidates for replacement:

Create a new file `apps/mobile/src/navigation/stacks.ts` that defines all simple stacks:

```typescript
import { createSimpleStack } from './create-simple-stack';

// Import screens
import CallsScreen from '@/screens/calls/WaiterCallsScreen';
import DeliveryScreen from '@/screens/delivery/DeliveryListScreen';
import ExpensesScreen from '@/screens/expenses/ExpensesListScreen';
import FeedbackScreen from '@/screens/feedback/FeedbackListScreen';
import KitchenScreen from '@/screens/kitchen/KitchenDisplayScreen';
import MenuManagementScreen from '@/screens/menu-management/MenuManagementScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import ReportsScreen from '@/screens/reports/ReportsScreen';
import SchedulesScreen from '@/screens/schedules/SchedulesScreen';
import StockScreen from '@/screens/stock/StockListScreen';
import TakeoutScreen from '@/screens/takeout/TakeoutListScreen';
import TasksScreen from '@/screens/tasks/TasksListScreen';
import WasteScreen from '@/screens/waste/WasteListScreen';
import CafeSettingsScreen from '@/screens/settings/CafeSettingsScreen';
import AuthScreen from '@/screens/auth/LoginScreen';

export const CallsStack = createSimpleStack({ name: 'WaiterCallsScreen', component: CallsScreen, title: 'Waiter Calls' });
export const DeliveryStack = createSimpleStack({ name: 'DeliveryListScreen', component: DeliveryScreen, title: 'Deliveries' });
// ... etc for all 15
```

**BUT FIRST** — read each existing stack file to check for any customizations:
- Custom `screenOptions` beyond the default?
- Custom `headerRight` in `options`?
- Translation calls like `t('nav.xxx')` for the title?
- Multiple `Stack.Screen` entries?

If a stack uses `useTranslation()` for the title, the factory needs to accept a function or the title must come from a hook. Read the existing stacks to check.

**If titles use `t()`**, the factory approach needs adjustment — the factory can't call hooks. In that case, keep the individual stack files but extract the common boilerplate into a shared component:

```typescript
// Simpler approach — a wrapper component instead of a factory
export function SimpleStackScreen({ 
  name, 
  component, 
  title 
}: { 
  name: string; 
  component: React.ComponentType; 
  title: string;
}) {
  const Stack = useMemo(() => createStackNavigator(), []);
  return (
    <Stack.Navigator>
      <Stack.Screen name={name} component={component} options={{ title, headerLeft: () => <DrawerMenuButton /> }} />
    </Stack.Navigator>
  );
}
```

Then each stack file becomes a 3-line file:
```typescript
import { SimpleStackScreen } from './SimpleStackScreen';
import Screen from '@/screens/calls/WaiterCallsScreen';
export function CallsStack() { return <SimpleStackScreen name="WaiterCallsScreen" component={Screen} title={t('nav.calls')} />; }
```

Read 3-4 stack files to determine the best approach, then apply consistently.

### Keep multi-screen stacks as-is:
- `OrdersStack.tsx` (4 screens) — keep
- `TablesStack.tsx` (2 screens) — keep
- `StaffManagementStack.tsx` (2 screens) — keep

### Update DrawerNavigator

**File:** `apps/mobile/src/navigation/DrawerNavigator.tsx`

After replacing individual stack files, update the drawer's screen imports to point to the new exports from `stacks.ts` (or wherever the factory outputs are).

---

## Step 3: Clean Up Redundant Type Re-Exports in api-client

**File:** `packages/api-client/src/index.ts`

Lines 7-73 explicitly re-export 44 types from `@gustri/database`. These are already available to any consumer that imports from `@gustri/database` directly. The re-export creates a second import path for the same types, causing confusion (e.g., `MenuItemWithCategory` imported from 3 paths in customer-web).

### Decision: Keep or Remove?

**Option A (remove):** Delete the 44 `export type { ... } from '@gustri/database'` lines. Any app code importing these types from `@gustri/api-client` will break and need to be updated to import from `@gustri/database` instead.

Search for the impact:
```bash
grep -rn "from '@gustri/api-client'" apps/ --include="*.ts" --include="*.tsx" | grep "type"
```

If very few files import types from `@gustri/api-client`, Option A is clean.

**Option B (keep + comment):** Keep the re-exports but add a comment explaining they're convenience re-exports. This avoids breaking existing imports but perpetuates the dual-path problem.

**Option C (replace with wildcard):** Replace the 44 explicit re-exports with:
```typescript
export type * from '@gustri/database';
```

This keeps backward compatibility, is self-maintaining (new types automatically re-exported), and reduces the 65-line block to 1 line. However, `export type *` is only supported in TypeScript 5.0+. Check `tsconfig.json` for the TypeScript version.

### Recommended: Option C if TypeScript supports it, otherwise Option B.

Read `packages/api-client/tsconfig.json` to check TypeScript version. If `>=5.0`:

Replace lines 7-73 with:
```typescript
// Re-export all types from @gustri/database for convenience
export type * from '@gustri/database';
```

---

## Final Verification

```bash
pnpm type-check   # Catches broken imports
pnpm test          # All tests pass
pnpm check         # Biome
```

For mobile navigation changes, test on simulator:
- Verify each drawer menu item navigates to the correct screen
- Verify the header title displays correctly
- Verify the drawer menu button works on each screen

## Commit

Commit with message: `refactor: reduce mobile navigation boilerplate, clean up redundant api-client type re-exports`
