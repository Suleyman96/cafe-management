import { createDrawerNavigator } from '@react-navigation/drawer';
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

export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="Home" component={MainTabs} />
      <Drawer.Screen name="DeliveryTab" component={DeliveryStack} />
      <Drawer.Screen name="TakeoutTab" component={TakeoutStack} />
      <Drawer.Screen name="TasksTab" component={TasksStack} />
      <Drawer.Screen name="FeedbackTab" component={FeedbackStack} />
      <Drawer.Screen name="StockTab" component={StockStack} />
      <Drawer.Screen name="WasteTab" component={WasteStack} />
      <Drawer.Screen name="ExpensesTab" component={ExpensesStack} />
      <Drawer.Screen name="StaffManagementTab" component={StaffManagementStack} />
      <Drawer.Screen name="MenuManagementTab" component={MenuManagementStack} />
      <Drawer.Screen name="SchedulesTab" component={SchedulesStack} />
      <Drawer.Screen name="ReportsTab" component={ReportsStack} />
      <Drawer.Screen name="CafeSettingsTab" component={CafeSettingsStack} />
    </Drawer.Navigator>
  );
}
