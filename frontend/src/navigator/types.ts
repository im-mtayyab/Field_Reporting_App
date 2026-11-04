import { ComponentProps } from 'react';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import {
  CompositeScreenProps,
  NavigationContainer,
  NavigatorScreenParams,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

export type MainTabParamList = {
  HomeScreen: undefined;
  CreateScreen: undefined;
  ReportsScreen: undefined;
  SyncScreen: undefined;
  SettingsScreen: undefined;
};

export type AppStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
};

export type AppStackScreenProps<T extends keyof AppStackParamList> =
  NativeStackScreenProps<AppStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    AppStackScreenProps<keyof AppStackParamList>
  >;

export interface NavigationProps
  extends Partial<
    ComponentProps<typeof NavigationContainer<AppStackParamList>>
  > {}
