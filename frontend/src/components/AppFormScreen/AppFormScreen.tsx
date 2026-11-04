import { type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { colors } from '../../theme';

type AppFormScreenProps = {
  children: ReactNode;
  /** Horizontal padding (default true) */
  padded?: boolean;
  /** Gap between focused input and keyboard. */
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Form screen with keyboard-aware scrolling.
 * Pair with `adjustNothing` on Android so the OS does not also resize the window
 * (that combo causes a large empty gap above the keyboard).
 *
 * @example
 * <AppFormScreen>
 *   <TextInput ... />
 * </AppFormScreen>
 */
export function AppFormScreen({
  children,
  padded = true,
  bottomOffset = 0,
  style,
  contentStyle,
}: AppFormScreenProps) {
  return (
    <View style={[styles.base, style]}>
      <KeyboardAwareScrollView
        mode="insets"
        bottomOffset={bottomOffset}
        extraKeyboardSpace={0}
        disableScrollOnKeyboardHide
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          padded && styles.padded,
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  scrollContent: {
    flexGrow: 0,
  },
});
