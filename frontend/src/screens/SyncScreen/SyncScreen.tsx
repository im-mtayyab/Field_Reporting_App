import { StyleSheet, View } from 'react-native';

import { AppHeader, AppScreen, AppText, TextVariant } from '../../components';

export function SyncScreen() {
  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader />
      <View style={styles.body}>
        <AppText variant={TextVariant.Body} color="textSoft">
          Sync status will land here.
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});
