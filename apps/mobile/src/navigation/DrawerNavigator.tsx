import { createDrawerNavigator } from '@react-navigation/drawer';
import { CustomDrawerContent } from '@/components/navigation/CustomDrawerContent';
import type { DrawerParamList } from '@/types';
import { CafeSettingsStack } from './CafeSettingsStack';
import { DeliveryStack } from './DeliveryStack';
import { ExpensesStack } from './ExpensesStack';
import { FeedbackStack } from './FeedbackStack';
import { MainTabs } from './MainTabs';
import { MenuManagementStack } from './MenuManagementStack';
import { ReportsStack } from './ReportsStack';
import { SchedulesStack } from './SchedulesStack';
import { StaffManagementStack } from './StaffManagementStack';
import { StockStack } from './StockStack';
import { TasksStack } from './TasksStack';
import { WasteStack } from './WasteStack';

const Drawer = createDrawerNavigator<DrawerParamList>();

export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props: any) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
      }}
    >
      <Drawer.Screen name="Home" component={MainTabs} />
      <Drawer.Screen name="DeliveryTab" component={DeliveryStack} />
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
