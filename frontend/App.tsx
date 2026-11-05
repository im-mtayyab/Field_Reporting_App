/**
 * Field Reporting React Native App
 *
 * @format
 */

import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ensureDbReady } from './src/db';
import { AppStack } from './src/navigator';
import { colors } from './src/theme';

function App() {
  useEffect(() => {
    // Fire-and-forget: migrate SQLite before any upload-queue work.
    void ensureDbReady();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
          <StatusBar barStyle="light-content" />
          {/* Top inset only — bottom inset lives on the tab bar so keyboard
              avoidance does not stack SafeArea + tab bar + keyboard height. */}
          <SafeAreaView style={styles.headerSafe} edges={['top']}>
            <View style={styles.root}>
              <AppStack />
            </View>
          </SafeAreaView>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerSafe: {
    flex: 1,
    backgroundColor: colors.header,
  },
});

export default App;
