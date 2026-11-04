import { createNavigationContainerRef } from '@react-navigation/native';

import type { AppStackParamList } from './types';

/** Root navigation ref for use outside React components. */
export const navigationRef = createNavigationContainerRef<AppStackParamList>();
