import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText, TextVariant } from '../AppText/AppText';

type ScreenIntroProps = {
  title: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Scrollable screen title and supporting description.
 * Place inside the screen’s ScrollView or list header — not in AppHeader.
 */
export function ScreenIntro({ title, description, style }: ScreenIntroProps) {
  return (
    <View style={[styles.wrap, style]}>
      <AppText variant={TextVariant.Headline} color="text">
        {title}
      </AppText>
      {description ? (
        <AppText variant={TextVariant.Body} color="textSoft" style={styles.lede}>
          {description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  lede: {
    lineHeight: 22,
  },
});
