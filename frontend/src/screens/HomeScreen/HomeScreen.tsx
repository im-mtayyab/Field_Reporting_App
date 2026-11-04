import { StyleSheet } from 'react-native';

import { AppScreen, AppText, TextVariant } from '../../components';

export function HomeScreen() {
  return (
    <AppScreen contentStyle={styles.content}>
      <AppText variant={TextVariant.Headline} color="primary">
        Home
      </AppText>
      <AppText variant={TextVariant.Body} color="textSoft" style={styles.subtitle}>
        Field reporting overview
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
  },
});
