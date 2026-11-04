import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { StatusTone } from '../../theme';

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
      <Text style={[styles.label, { color: tone.color }]}>{tone.label}</Text>
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
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
