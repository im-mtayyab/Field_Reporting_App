import { Platform, type ViewStyle } from 'react-native';

import { colors } from '../../theme';

/** iOS UITabBar: 49 · Android Material bottom nav: 56 (+ bottom inset). */
const TAB_BAR_HEIGHT = Platform.select({ ios: 49, default: 56 })!;

export function buildTabBarStyle(bottomInset: number): ViewStyle {
  return {
    height: TAB_BAR_HEIGHT + bottomInset,
    paddingBottom: bottomInset,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    elevation: 0,
    ...Platform.select({
      ios: {
        shadowColor: colors.radialEdge,
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      default: {},
    }),
  };
}
