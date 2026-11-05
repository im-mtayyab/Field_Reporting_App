import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { AppText, TextVariant } from '../../../components';
import { colors } from '../../../theme';

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <View style={styles.sectionAccent} />
        <AppText
          variant={TextVariant.Overline}
          color="textSoft"
          style={styles.sectionTitle}
        >
          {title}
        </AppText>
      </View>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export function Row({
  label,
  detail,
  right,
  onPress,
  last,
  disabled,
  showChevron,
}: {
  label: string;
  detail?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  disabled?: boolean;
  /** Auto when onPress is set, unless overridden. */
  showChevron?: boolean;
}) {
  const chevron = showChevron ?? Boolean(onPress && !right);

  const content = (
    <View
      style={[
        styles.row,
        !last && styles.rowBorder,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={styles.rowText}>
        <AppText variant={TextVariant.Label} color="text">
          {label}
        </AppText>
        {detail ? (
          <AppText variant={TextVariant.Caption} color="textSoft">
            {detail}
          </AppText>
        ) : null}
      </View>
      {right}
      {chevron ? (
        <ChevronRight size={18} color={colors.accent} strokeWidth={2.25} />
      ) : null}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

export function Radio({ selected }: { selected: boolean }) {
  return <View style={[styles.radio, selected && styles.radioOn]} />;
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionAccent: {
    width: 3,
    height: 12,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
  },
  sectionTitle: {
    textTransform: 'uppercase',
  },
  group: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 64,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  radioOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
