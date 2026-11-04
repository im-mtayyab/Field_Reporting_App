import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '../../theme';

type CardProps = {
  children: ReactNode;
  /** Yellow bar on top */
  accentTop?: boolean;
  /** Yellow bar on the left */
  accentLeft?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** Bordered panel — sharp corners, optional accent bars. */
export function Card({
  children,
  accentTop = false,
  accentLeft = false,
  style,
  contentStyle,
}: CardProps) {
  return (
    <View style={[styles.card, accentLeft && styles.accentLeftPad, style]}>
      {accentTop ? <View style={styles.accentTop} /> : null}
      {accentLeft ? <View style={styles.accentLeft} /> : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 0,
    overflow: 'hidden',
  },
  accentLeftPad: {
    paddingLeft: 4,
  },
  accentTop: {
    height: 4,
    backgroundColor: colors.accent,
  },
  accentLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accent,
  },
  content: {
    padding: 16,
  },
});
