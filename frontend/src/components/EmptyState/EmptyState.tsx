import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors } from '../../theme';
import { AppText, TextVariant } from '../AppText/AppText';

type EmptyStateProps = {
  Icon: LucideIcon;
  title: string;
  description?: string;
};

/** Empty list / empty screen placeholder. */
export function EmptyState({ Icon, title, description }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Icon size={36} color={colors.primary} strokeWidth={1.75} />
      </View>
      <AppText
        variant={TextVariant.Headline}
        color="text"
        style={styles.title}
      >
        {title}
      </AppText>
      {description ? (
        <AppText
          variant={TextVariant.Body}
          color="textSoft"
          style={styles.description}
        >
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    marginTop: 8,
    textAlign: 'center',
  },
});
