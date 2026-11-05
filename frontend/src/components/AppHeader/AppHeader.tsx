import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ChevronLeft, Plus, Settings } from 'lucide-react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';

import { colors } from '../../theme';
import { AppText, TextVariant } from '../AppText/AppText';

const APP_NAME = 'Field Reports';
const SIDE = 88;

type AppHeaderProps = {
  /** Stack screen title when showBack is set. */
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Top app bar — brand left; Create + Settings right (or back + centered title). */
export function AppHeader({
  title,
  showBack = false,
  onBack,
  right,
  style,
}: AppHeaderProps) {
  const navigation = useNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const openTab = (name: 'CreateScreen' | 'SettingsScreen') => {
    navigation.dispatch(CommonActions.navigate({ name }));
  };

  if (showBack) {
    return (
      <View style={[styles.bar, styles.barBack, style]}>
        <View style={styles.side}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={handleBack}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <ChevronLeft size={24} color={colors.white} strokeWidth={2.25} />
          </Pressable>
        </View>

        <AppText
          variant={TextVariant.Title}
          color="white"
          numberOfLines={1}
          style={styles.centerTitle}
        >
          {title ?? APP_NAME}
        </AppText>

        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>
    );
  }

  return (
    <View style={[styles.bar, style]}>
      <AppText
        variant={TextVariant.Title}
        color="white"
        numberOfLines={1}
        style={styles.brand}
      >
        {APP_NAME}
      </AppText>

      <View style={styles.actions}>
        {right ?? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create report"
              hitSlop={8}
              onPress={() => openTab('CreateScreen')}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.pressed,
              ]}
            >
              <Plus size={22} color={colors.white} strokeWidth={2.25} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              hitSlop={8}
              onPress={() => openTab('SettingsScreen')}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.pressed,
              ]}
            >
              <Settings size={22} color={colors.white} strokeWidth={2.25} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.header,
  },
  barBack: {
    paddingLeft: 4,
    paddingRight: 4,
  },
  brand: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: SIDE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  centerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
