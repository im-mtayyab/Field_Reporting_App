import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../../theme';
import { AppTabs } from '../AppTabs/AppTabs';
import type { AppStackParamList, NavigationProps } from '../types';
import { navigationRef } from '../utilities';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStack(props: NavigationProps) {
  return (
    <NavigationContainer ref={navigationRef} {...props}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
        initialRouteName="Main"
      >
        <Stack.Screen name="Main" component={AppTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
