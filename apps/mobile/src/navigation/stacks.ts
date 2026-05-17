import WaiterCallsScreen from '@/screens/calls/WaiterCallsScreen';
import KitchenDisplayScreen from '@/screens/kitchen/KitchenDisplayScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import { createSimpleStack } from './create-simple-stack';
import { lazyScreen } from './lazy-screen';

// Tab-root stacks: eagerly imported because they're mounted on initial app
// load (Kitchen for kitchen role, Calls and Profile for everyone else).
// Suspense fallbacks here would flicker on first paint.

export const CallsStack = createSimpleStack({
  name: 'WaiterCallsList',
  component: WaiterCallsScreen,
  titleKey: 'waiterCalls',
});

export const KitchenStack = createSimpleStack({
  name: 'KitchenDisplay',
  component: KitchenDisplayScreen,
  titleKey: 'kitchen',
});

export const ProfileStack = createSimpleStack({
  name: 'Profile',
  component: ProfileScreen,
  titleKey: 'profile',
});

// Drawer-only stacks: lazy-loaded. Each screen's JS is parsed on first open,
// not at app startup — meaningful win on budget Android where a waiter never
// opens MenuManagement/Reports/etc. but pays the parse cost otherwise.

export const CafeSettingsStack = createSimpleStack({
  name: 'CafeSettings',
  component: lazyScreen(() => import('@/screens/settings/CafeSettingsScreen')),
  titleKey: 'cafeSettings',
});

export const DeliveryStack = createSimpleStack({
  name: 'DeliveryList',
  component: lazyScreen(() => import('@/screens/delivery/DeliveryListScreen')),
  titleKey: 'delivery',
});

export const ExpensesStack = createSimpleStack({
  name: 'ExpensessList',
  component: lazyScreen(() => import('@/screens/expenses/ExpensesListScreen')),
  titleKey: 'expenses',
});

export const FeedbackStack = createSimpleStack({
  name: 'FeedbackList',
  component: lazyScreen(() => import('@/screens/feedback/FeedbackListScreen')),
  titleKey: 'feedback',
});

export const MenuManagementStack = createSimpleStack({
  name: 'MenuManagement',
  component: lazyScreen(() => import('@/screens/menu-management/MenuManagementScreen')),
  titleKey: 'menuManagement',
});

export const ReportsStack = createSimpleStack({
  name: 'Reports',
  component: lazyScreen(() => import('@/screens/reports/ReportsScreen')),
  titleKey: 'reports',
});

export const SchedulesStack = createSimpleStack({
  name: 'Schedules',
  component: lazyScreen(() => import('@/screens/schedules/SchedulesScreen')),
  titleKey: 'schedules',
});

export const StockStack = createSimpleStack({
  name: 'StockList',
  component: lazyScreen(() => import('@/screens/stock/StockListScreen')),
  titleKey: 'stock',
});

export const TakeoutStack = createSimpleStack({
  name: 'TakeoutList',
  component: lazyScreen(() => import('@/screens/takeout/TakeoutListScreen')),
  titleKey: 'takeout',
});

export const TasksStack = createSimpleStack({
  name: 'TasksList',
  component: lazyScreen(() => import('@/screens/tasks/TasksListScreen')),
  titleKey: 'tasks',
});

export const WasteStack = createSimpleStack({
  name: 'WasteList',
  component: lazyScreen(() => import('@/screens/waste/WasteListScreen')),
  titleKey: 'waste',
});
