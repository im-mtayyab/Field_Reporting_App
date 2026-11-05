import { Switch, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { AppHeader, AppScreen, ScreenIntro } from '../../components';
import type { MainTabScreenProps } from '../../navigator/types';
import { useTesterSettings } from '../../store/testerSettings';
import { colors } from '../../theme';
import { Row, Section } from './components/SettingsList';

export function SettingsScreen() {
  const navigation =
    useNavigation<MainTabScreenProps<'SettingsScreen'>['navigation']>();
  const {
    saveSyncLogs,
    setSaveSyncLogs,
    parallelUploads,
    setParallelUploads,
  } = useTesterSettings();

  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader />
      <KeyboardAwareScrollView
        mode="insets"
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.body}
      >
        <ScreenIntro
          title="Settings"
          description="Manage upload preferences for this device. Advanced test tools are available separately for review and demonstration."
        />
        <Section title="Uploads">
          <Row
            label="Upload photos in parallel"
            detail={
              parallelUploads
                ? 'Upload all ready photos concurrently. Pause, resume, and retry remain available per photo.'
                : 'Upload one photo at a time. Enable this option to upload several photos concurrently.'
            }
            right={
              <Switch
                value={parallelUploads}
                onValueChange={setParallelUploads}
                trackColor={{ true: colors.accent, false: colors.borderStrong }}
                thumbColor={colors.white}
              />
            }
          />
          <Row
            label="Save upload logs"
            detail="Keep transfer events on this device"
            right={
              <Switch
                value={saveSyncLogs}
                onValueChange={setSaveSyncLogs}
                trackColor={{ true: colors.accent, false: colors.borderStrong }}
                thumbColor={colors.white}
              />
            }
          />
          <Row
            label="View upload logs"
            detail="Browse saved transfer activity"
            onPress={() => navigation.navigate('SyncLogsScreen')}
            last
          />
        </Section>

        <Section title="Advanced">
          <Row
            label="Test tools"
            detail="Simulate failures, network delay, reset data"
            onPress={() => navigation.navigate('TestToolsScreen')}
            last
          />
        </Section>
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
});
