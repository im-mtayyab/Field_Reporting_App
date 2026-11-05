import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ClipboardList,
  Home as HomeIcon,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react-native';

import {
  CreateScreen,
  HomeScreen,
  ReportsScreen,
  SettingsScreen,
  SyncScreen,
} from '../../screens';
import { colors, TextVariant, typography } from '../../theme';
import type { MainTabParamList } from '../types';
import { TabBarButton } from './components/TabBarButton/TabBarButton';
import { TabIcon } from './components/TabIcon/TabIcon';
import { buildTabBarStyle } from './utils';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Tabs: Home · Reports · Create · Sync · Settings */
export function AppTabs() {
  const insets = useSafeAreaInsets();
  const tabBarStyle = buildTabBarStyle(insets.bottom);

  return (
    <Tab.Navigator
      safeAreaInsets={{ top: 0, right: 0, bottom: 0, left: 0 }}
      screenOptions={{
        headerShown: false,
        // Avoid empty band above keyboard (tab bar + keyboard insets stacking).
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarStyle,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tab.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={HomeIcon} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ReportsScreen"
        component={ReportsScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={ClipboardList} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="CreateScreen"
        component={CreateScreen}
        options={{
          tabBarLabel: 'Create',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Plus} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="SyncScreen"
        component={SyncScreen}
        options={{
          tabBarLabel: 'Upload',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={RefreshCw} color={color} focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={SettingsIcon} color={color} focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarItem: {
    paddingTop: 0,
  },
  tabBarLabel: {
    ...typography[TextVariant.Caption],
    marginTop: 2,
  },
});
