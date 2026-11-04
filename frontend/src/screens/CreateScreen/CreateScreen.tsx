import { StyleSheet } from 'react-native';

import { AppFormScreen, AppText, TextVariant } from '../../components';

export function CreateScreen() {
  return (
    <AppFormScreen contentStyle={styles.content}>
      <AppText variant={TextVariant.Headline} color="primary">
        Create
      </AppText>
      <AppText variant={TextVariant.Body} color="textSoft" style={styles.subtitle}>
        Create a new field report
      </AppText>
    </AppFormScreen>
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
