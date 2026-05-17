import { ScreenHeader } from '@gustri/ui-mobile';
import { createStackNavigator } from '@react-navigation/stack';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import { headerOptions } from '@/navigation/header-options';
import TableDetailScreen from '@/screens/tables/TableDetailScreen';
import TablesListScreen from '@/screens/tables/TablesListScreen';
import type { TablesStackParamList } from '@/types';

const Stack = createStackNavigator<TablesStackParamList>();

export function TablesStack() {
  return (
    <Stack.Navigator screenOptions={{ header: (props) => <ScreenHeader {...props} /> }}>
      <Stack.Screen
        name="TablesList"
        component={TablesListScreen}
        options={headerOptions({ titleKey: 'tables', headerLeft: () => <DrawerMenuButton /> })}
      />
      <Stack.Screen
        name="TableDetail"
        component={TableDetailScreen}
        options={headerOptions({ titleKey: 'tableDetail' })}
      />
    </Stack.Navigator>
  );
}
