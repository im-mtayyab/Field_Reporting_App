import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  ReportDetailScreen,
  SyncLogsScreen,
  TestToolsScreen,
} from '../../screens';
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
          animation: 'slide_from_right',
          animationTypeForReplace: 'push',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          contentStyle: { backgroundColor: colors.surface },
        }}
        initialRouteName="Main"
      >
        <Stack.Screen name="Main" component={AppTabs} />
        <Stack.Screen
          name="ReportDetailScreen"
          component={ReportDetailScreen}
        />
        <Stack.Screen name="SyncLogsScreen" component={SyncLogsScreen} />
        <Stack.Screen name="TestToolsScreen" component={TestToolsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
