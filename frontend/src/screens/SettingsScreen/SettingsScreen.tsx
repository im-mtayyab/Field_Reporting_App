import { StyleSheet, View } from 'react-native';

import { AppHeader, AppScreen, AppText, TextVariant } from '../../components';

export function SettingsScreen() {
  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader />
      <View style={styles.body}>
        <AppText variant={TextVariant.Body} color="textSoft">
          Settings will land here.
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
