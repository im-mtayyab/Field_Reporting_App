import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

import { colors } from '../../theme';
import { AppText, TextVariant } from '../AppText/AppText';

type GlobalLoaderProps = {
  visible: boolean;
  message?: string;
  detail?: string;
};

/** Full-screen blocking loader for save and prepare operations. */
export function GlobalLoader({
  visible,
  message = 'Please wait…',
  detail,
}: GlobalLoaderProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View style={styles.overlay} pointerEvents="auto">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText variant={TextVariant.Label} color="white">
              Field Reports
            </AppText>
          </View>
          <View style={styles.cardBody}>
            <ActivityIndicator color={colors.primary} size="large" />
            <AppText
              variant={TextVariant.Body}
              color="text"
              style={styles.message}
            >
              {message}
            </AppText>
            {detail ? (
              <AppText
                variant={TextVariant.Caption}
                color="textSoft"
                style={styles.detail}
              >
                {detail}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 32, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    minWidth: 220,
    maxWidth: 320,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cardHeader: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.footerBar,
  },
  cardBody: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  message: {
    textAlign: 'center',
  },
  detail: {
    textAlign: 'center',
  },
});
