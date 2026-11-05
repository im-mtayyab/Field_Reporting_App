import { ComponentProps } from 'react';
import {
  BottomTabNavigationProp,
  BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import {
  CompositeNavigationProp,
  CompositeScreenProps,
  NavigationContainer,
  NavigatorScreenParams,
} from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

export type MainTabParamList = {
  HomeScreen: undefined;
  CreateScreen: undefined;
  ReportsScreen: undefined;
  SyncScreen: undefined;
  SettingsScreen: undefined;
};

export type AppStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  ReportDetailScreen: { reportId: string };
  SyncLogsScreen: { reportId?: string; title?: string } | undefined;
  TestToolsScreen: undefined;
};

export type AppStackScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    AppStackScreenProps<keyof AppStackParamList>
  >;

export type ReportsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'ReportsScreen'>,
  NativeStackNavigationProp<AppStackParamList>
>;

export interface NavigationProps
  extends Partial<
    ComponentProps<typeof NavigationContainer<AppStackParamList>>
  > {}
