import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { StatusTone } from '../../theme';
import { AppText, TextVariant } from '../AppText/AppText';

type StatusPillProps = {
  /** Any domain can pass a tone (reports, attachments, logs, …). */
  tone: StatusTone;
  style?: StyleProp<ViewStyle>;
};

/** Generic status chip — only renders the tone you pass in. */
export function StatusPill({ tone, style }: StatusPillProps) {
  return (
    <View
      style={[styles.pill, { backgroundColor: tone.backgroundColor }, style]}
    >
      <AppText
        variant={TextVariant.Overline}
        style={[styles.label, { color: tone.color }]}
      >
        {tone.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  label: {
    textTransform: 'uppercase',
  },
});
