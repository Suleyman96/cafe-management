import { createDrawerNavigator } from '@react-navigation/drawer';
import { withErrorBoundary } from '@/components/ErrorBoundary';
import { CustomDrawerContent } from '@/components/navigation/CustomDrawerContent';
import type { DrawerParamList } from '@/types';
import { MainTabs } from './MainTabs';
import { StaffManagementStack } from './StaffManagementStack';
import {
  CafeSettingsStack,
  DeliveryStack,
  ExpensesStack,
  FeedbackStack,
  MenuManagementStack,
  ReportsStack,
  SchedulesStack,
  StockStack,
  TakeoutStack,
  TasksStack,
  WasteStack,
} from './stacks';

const Drawer = createDrawerNavigator<DrawerParamList>();

// Each tab/stack gets its OWN ErrorBoundary so a render throw in one screen is
// isolated — the drawer and every other tab stay usable (and the crashed screen
// offers "Try again") instead of the single root boundary blanking the whole
// app. Wrapped at module scope for stable identity; an inline `withErrorBoundary`
// in the `component=` prop would remount the screen on every render.
const HomeScreen = withErrorBoundary(MainTabs);
const DeliveryScreen = withErrorBoundary(DeliveryStack);
const TakeoutScreen = withErrorBoundary(TakeoutStack);
const TasksScreen = withErrorBoundary(TasksStack);
const FeedbackScreen = withErrorBoundary(FeedbackStack);
const StockScreen = withErrorBoundary(StockStack);
const WasteScreen = withErrorBoundary(WasteStack);
const ExpensesScreen = withErrorBoundary(ExpensesStack);
const StaffManagementScreen = withErrorBoundary(StaffManagementStack);
const MenuManagementScreen = withErrorBoundary(MenuManagementStack);
const SchedulesScreen = withErrorBoundary(SchedulesStack);
const ReportsScreen = withErrorBoundary(ReportsStack);
const CafeSettingsScreen = withErrorBoundary(CafeSettingsStack);

export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="DeliveryTab" component={DeliveryScreen} />
      <Drawer.Screen name="TakeoutTab" component={TakeoutScreen} />
      <Drawer.Screen name="TasksTab" component={TasksScreen} />
      <Drawer.Screen name="FeedbackTab" component={FeedbackScreen} />
      <Drawer.Screen name="StockTab" component={StockScreen} />
      <Drawer.Screen name="WasteTab" component={WasteScreen} />
      <Drawer.Screen name="ExpensesTab" component={ExpensesScreen} />
      <Drawer.Screen name="StaffManagementTab" component={StaffManagementScreen} />
      <Drawer.Screen name="MenuManagementTab" component={MenuManagementScreen} />
      <Drawer.Screen name="SchedulesTab" component={SchedulesScreen} />
      <Drawer.Screen name="ReportsTab" component={ReportsScreen} />
      <Drawer.Screen name="CafeSettingsTab" component={CafeSettingsScreen} />
    </Drawer.Navigator>
  );
}
