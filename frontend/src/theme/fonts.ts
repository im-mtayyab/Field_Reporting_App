import { Platform } from 'react-native';

/** Platform system fonts for iOS (San Francisco) and Android (Roboto). */
export const fonts = {
  regular: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }) as string,

  medium: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'System',
  }) as string,

  bold: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }) as string,
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  bold: '700' as const,
};
