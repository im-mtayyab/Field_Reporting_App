import { StyleSheet } from 'react-native';

import { AppScreen, AppText, TextVariant } from '../../components';

export function SyncScreen() {
  return (
    <AppScreen contentStyle={styles.content}>
      <AppText variant={TextVariant.Headline} color="primary">
        Sync
      </AppText>
      <AppText variant={TextVariant.Body} color="textSoft" style={styles.subtitle}>
        Sync Logs and Status
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
