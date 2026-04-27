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
  title: 'Waiter Calls',
});

export const KitchenStack = createSimpleStack({
  name: 'KitchenDisplay',
  component: KitchenDisplayScreen,
  title: 'Kitchen',
});

export const ProfileStack = createSimpleStack({
  name: 'Profile',
  component: ProfileScreen,
  title: 'Profile',
});

// Drawer-only stacks: lazy-loaded. Each screen's JS is parsed on first open,
// not at app startup — meaningful win on budget Android where a waiter never
// opens MenuManagement/Reports/etc. but pays the parse cost otherwise.

export const CafeSettingsStack = createSimpleStack({
  name: 'CafeSettings',
  component: lazyScreen(() => import('@/screens/settings/CafeSettingsScreen')),
  title: 'Cafe Settings',
});

export const DeliveryStack = createSimpleStack({
  name: 'DeliveryList',
  component: lazyScreen(() => import('@/screens/delivery/DeliveryListScreen')),
  title: 'Delivery',
});

export const ExpensesStack = createSimpleStack({
  name: 'ExpensessList',
  component: lazyScreen(() => import('@/screens/expenses/ExpensesListScreen')),
  title: 'Expenses',
});

export const FeedbackStack = createSimpleStack({
  name: 'FeedbackList',
  component: lazyScreen(() => import('@/screens/feedback/FeedbackListScreen')),
  title: 'Feedback',
});

export const MenuManagementStack = createSimpleStack({
  name: 'MenuManagement',
  component: lazyScreen(() => import('@/screens/menu-management/MenuManagementScreen')),
  title: 'Menu Management',
});

export const ReportsStack = createSimpleStack({
  name: 'Reports',
  component: lazyScreen(() => import('@/screens/reports/ReportsScreen')),
  title: 'Reports',
});

export const SchedulesStack = createSimpleStack({
  name: 'Schedules',
  component: lazyScreen(() => import('@/screens/schedules/SchedulesScreen')),
  title: 'Schedules',
});

export const StockStack = createSimpleStack({
  name: 'StockList',
  component: lazyScreen(() => import('@/screens/stock/StockListScreen')),
  title: 'Stock',
});

export const TakeoutStack = createSimpleStack({
  name: 'TakeoutList',
  component: lazyScreen(() => import('@/screens/takeout/TakeoutListScreen')),
  title: 'Takeout',
});

export const TasksStack = createSimpleStack({
  name: 'TasksList',
  component: lazyScreen(() => import('@/screens/tasks/TasksListScreen')),
  title: 'Tasks',
});

export const WasteStack = createSimpleStack({
  name: 'WasteList',
  component: lazyScreen(() => import('@/screens/waste/WasteListScreen')),
  title: 'Waste',
});
