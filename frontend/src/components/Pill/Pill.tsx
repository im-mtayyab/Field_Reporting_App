import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, type ColorName } from '../../theme';
import { AppText, TextVariant } from '../AppText/AppText';

type PillTone = 'accent' | 'surface' | 'primary';

type PillProps = {
  children: ReactNode;
  tone?: PillTone;
  style?: StyleProp<ViewStyle>;
};

const TONE_BG: Record<PillTone, string> = {
  accent: colors.accent,
  surface: colors.surfaceAlt,
  primary: colors.primary,
};

const TONE_TEXT: Record<PillTone, ColorName> = {
  accent: 'text',
  surface: 'text',
  primary: 'white',
};

/** Small status / count label. */
export function Pill({ children, tone = 'accent', style }: PillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: TONE_BG[tone] }, style]}>
      {typeof children === 'string' ? (
        <AppText variant={TextVariant.Overline} color={TONE_TEXT[tone]}>
          {children}
        </AppText>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 0,
  },
});
