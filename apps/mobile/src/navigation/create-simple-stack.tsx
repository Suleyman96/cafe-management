import { createStackNavigator } from '@react-navigation/stack';
import type React from 'react';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';

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
      <Stack.Navigator>
        <Stack.Screen
          name={name}
          component={component}
          options={{ title, headerLeft: () => <DrawerMenuButton /> }}
        />
      </Stack.Navigator>
    );
  }

  SimpleStack.displayName = `${name}Stack`;
  return SimpleStack;
}
