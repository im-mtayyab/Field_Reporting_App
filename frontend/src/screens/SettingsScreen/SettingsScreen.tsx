import { StyleSheet } from 'react-native';

import { AppScreen, AppText, TextVariant } from '../../components';

export function SettingsScreen() {
  return (
    <AppScreen contentStyle={styles.content}>
      <AppText variant={TextVariant.Headline} color="primary">
        Settings
      </AppText>
      <AppText variant={TextVariant.Body} color="textSoft" style={styles.subtitle}>
        App Settings and Preferences
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
