import WaiterCallsScreen from '@/screens/calls/WaiterCallsScreen';
import DeliveryListScreen from '@/screens/delivery/DeliveryListScreen';
import ExpensesListScreen from '@/screens/expenses/ExpensesListScreen';
import FeedbackListScreen from '@/screens/feedback/FeedbackListScreen';
import KitchenDisplayScreen from '@/screens/kitchen/KitchenDisplayScreen';
import MenuManagementScreen from '@/screens/menu-management/MenuManagementScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import ReportsScreen from '@/screens/reports/ReportsScreen';
import SchedulesScreen from '@/screens/schedules/SchedulesScreen';
import CafeSettingsScreen from '@/screens/settings/CafeSettingsScreen';
import StockListScreen from '@/screens/stock/StockListScreen';
import TakeoutListScreen from '@/screens/takeout/TakeoutListScreen';
import TasksListScreen from '@/screens/tasks/TasksListScreen';
import WasteListScreen from '@/screens/waste/WasteListScreen';
import { createSimpleStack } from './create-simple-stack';

export const CafeSettingsStack = createSimpleStack({
  name: 'CafeSettings',
  component: CafeSettingsScreen,
  title: 'Cafe Settings',
});

export const CallsStack = createSimpleStack({
  name: 'WaiterCallsList',
  component: WaiterCallsScreen,
  title: 'Waiter Calls',
});

export const DeliveryStack = createSimpleStack({
  name: 'DeliveryList',
  component: DeliveryListScreen,
  title: 'Delivery',
});

export const ExpensesStack = createSimpleStack({
  name: 'ExpensessList',
  component: ExpensesListScreen,
  title: 'Expenses',
});

export const FeedbackStack = createSimpleStack({
  name: 'FeedbackList',
  component: FeedbackListScreen,
  title: 'Feedback',
});

export const KitchenStack = createSimpleStack({
  name: 'KitchenDisplay',
  component: KitchenDisplayScreen,
  title: 'Kitchen',
});

export const MenuManagementStack = createSimpleStack({
  name: 'MenuManagement',
  component: MenuManagementScreen,
  title: 'Menu Management',
});

export const ProfileStack = createSimpleStack({
  name: 'Profile',
  component: ProfileScreen,
  title: 'Profile',
});

export const ReportsStack = createSimpleStack({
  name: 'Reports',
  component: ReportsScreen,
  title: 'Reports',
});

export const SchedulesStack = createSimpleStack({
  name: 'Schedules',
  component: SchedulesScreen,
  title: 'Schedules',
});

export const StockStack = createSimpleStack({
  name: 'StockList',
  component: StockListScreen,
  title: 'Stock',
});

export const TakeoutStack = createSimpleStack({
  name: 'TakeoutList',
  component: TakeoutListScreen,
  title: 'Takeout',
});

export const TasksStack = createSimpleStack({
  name: 'TasksList',
  component: TasksListScreen,
  title: 'Tasks',
});

export const WasteStack = createSimpleStack({
  name: 'WasteList',
  component: WasteListScreen,
  title: 'Waste',
});
