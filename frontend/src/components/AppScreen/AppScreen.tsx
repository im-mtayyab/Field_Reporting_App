import { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '../../theme';

type AppScreenProps = {
  children: ReactNode;
  /** Wrap content in a ScrollView */
  scroll?: boolean;
  /** Horizontal + vertical padding (default true) */
  padded?: boolean;
  /** Extra style on the outer container */
  style?: StyleProp<ViewStyle>;
  /** Extra style on the inner content wrapper */
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Screen container with background color and optional scroll or padding.
 *
 * @example
 * <AppScreen>
 *   <AppText variant={TextVariant.Headline}>Home</AppText>
 * </AppScreen>
 *
 * @example
 * <AppScreen scroll>
 *   ...long form content
 * </AppScreen>
 */
export function AppScreen({
  children,
  scroll = false,
  padded = true,
  style,
  contentStyle,
}: AppScreenProps) {
  if (scroll) {
    return (
      <View style={[styles.base, style]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            padded && styles.padded,
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.base, padded && styles.padded, style, contentStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  padded: {
    paddingHorizontal: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
