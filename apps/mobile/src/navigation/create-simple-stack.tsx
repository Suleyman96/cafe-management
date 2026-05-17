import { ScreenHeader } from '@gustri/ui-mobile';
import { createStackNavigator, type StackScreenProps } from '@react-navigation/stack';
import type React from 'react';
import { DrawerMenuButton } from '@/components/navigation/DrawerMenuButton';
import { headerOptions } from '@/navigation/header-options';

type SimpleParamList = Record<string, undefined>;
type SimpleScreenProps = StackScreenProps<SimpleParamList, string>;

interface SimpleStackConfig {
  name: string;
  component: React.ComponentType<SimpleScreenProps>;
  /** i18n key resolved by the shared `ScreenHeader` (namespace `nav`). */
  titleKey: string;
}

export function createSimpleStack({ name, component, titleKey }: SimpleStackConfig) {
  const Stack = createStackNavigator<SimpleParamList>();

  function SimpleStack() {
    return (
      <Stack.Navigator screenOptions={{ header: (props) => <ScreenHeader {...props} /> }}>
        <Stack.Screen
          name={name}
          // React 18/19 @types/react clash between React Navigation and the
          // mobile app's React 19 install. Cast is structurally safe — the
          // SimpleScreenProps interface above is the real contract.
          component={component as React.ComponentType<unknown> as never}
          options={headerOptions({ titleKey, headerLeft: () => <DrawerMenuButton /> })}
        />
      </Stack.Navigator>
    );
  }

  SimpleStack.displayName = `${name}Stack`;
  return SimpleStack;
}
