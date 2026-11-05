import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  clearLocalUploadQueueAction,
  clearSyncLogsAction,
} from '../../actions/uploadActions';
import { deleteReportsAction } from '../../actions/reportActions';
import {
  AppHeader,
  AppScreen,
  AppText,
  GlobalLoader,
} from '../../components';
import {
  clampCustomChunkBytes,
  isPresetUploadChunk,
  LATENCY_PRESETS_MS,
  NETWORK_PROFILE_OPTIONS,
  SIMULATE_MODE_OPTIONS,
  UPLOAD_CHUNK_OPTIONS,
  useTesterSettings,
  type NetworkProfile,
  type SimulateMode,
} from '../../store/testerSettings';
import { colors, TextVariant, typography } from '../../theme';
import {
  Radio,
  Row,
  Section,
} from '../SettingsScreen/components/SettingsList';

const CHANCE_STEPS = [25, 50, 75, 100];
const CUSTOM_CHUNK_DEFAULT_KB = 64;

type PickerOption = {
  key: string;
  label: string;
  hint: string;
  kind: 'mode' | 'random';
  mode?: SimulateMode;
};

export function TestToolsScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const {
    simulateMode,
    clientLatencyMs,
    networkProfile,
    forceRandomErrors,
    randomErrorChance,
    failNextRequest,
    uploadChunkBytes,
    setNetworkProfile,
    setClientLatencyMs,
    setRandomErrorChance,
    setFailNextRequest,
    setUploadChunkBytes,
    applySimulateSelection,
  } = useTesterSettings();

  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chunkSavedFlash, setChunkSavedFlash] = useState(false);
  const [simulateSavedFlash, setSimulateSavedFlash] = useState(false);
  const chunkSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulateSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const customSelected = uploadChunkBytes > 0 && !isPresetUploadChunk(uploadChunkBytes);
  const [customChunkKbDraft, setCustomChunkKbDraft] = useState(() =>
    String(
      customSelected
        ? Math.round(uploadChunkBytes / 1024)
        : CUSTOM_CHUNK_DEFAULT_KB,
    ),
  );
  const chancePct = Math.round(randomErrorChance * 100);

  const savedCustomKb = customSelected
    ? Math.round(uploadChunkBytes / 1024)
    : null;
  const draftKb = Number.parseInt(customChunkKbDraft, 10);
  const chunkDirty =
    customSelected &&
    Number.isFinite(draftKb) &&
    draftKb !== savedCustomKb;

  useEffect(() => {
    return () => {
      if (chunkSavedTimer.current) {
        clearTimeout(chunkSavedTimer.current);
      }
      if (simulateSavedTimer.current) {
        clearTimeout(simulateSavedTimer.current);
      }
    };
  }, []);

  const flashChunkSaved = () => {
    setChunkSavedFlash(true);
    if (chunkSavedTimer.current) {
      clearTimeout(chunkSavedTimer.current);
    }
    chunkSavedTimer.current = setTimeout(() => {
      setChunkSavedFlash(false);
    }, 1400);
  };

  const applyCustomChunkKb = (raw: string) => {
    const parsed = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(parsed)) {
      setCustomChunkKbDraft(String(CUSTOM_CHUNK_DEFAULT_KB));
      setUploadChunkBytes(CUSTOM_CHUNK_DEFAULT_KB * 1024);
      flashChunkSaved();
      return;
    }
    const kb = Math.max(1, Math.min(512, parsed));
    setCustomChunkKbDraft(String(kb));
    setUploadChunkBytes(clampCustomChunkBytes(kb * 1024));
    flashChunkSaved();
  };

  const pickerOptions = useMemo<PickerOption[]>(
    () => [
      ...SIMULATE_MODE_OPTIONS.map((option) => ({
        key: option.value,
        label: option.label,
        hint: option.hint,
        kind: 'mode' as const,
        mode: option.value as SimulateMode,
      })),
      {
        key: 'random',
        label: 'Random',
        hint: 'Pick a random failure on some requests',
        kind: 'random' as const,
      },
    ],
    [],
  );

  const activeLabel = forceRandomErrors
    ? `Random ${chancePct}%`
    : (SIMULATE_MODE_OPTIONS.find((o) => o.value === simulateMode)?.label ??
      'None');

  const sheetMaxHeight = Math.min(windowHeight * 0.72, 560);

  const selectOption = useCallback(
    (option: PickerOption) => {
      if (option.kind === 'random') {
        applySimulateSelection({
          mode: 'random',
          randomChance: chancePct <= 0 ? 0.5 : randomErrorChance,
        });
      } else if (option.mode) {
        applySimulateSelection({ mode: option.mode });
      }
      setSimulateSavedFlash(true);
      if (simulateSavedTimer.current) {
        clearTimeout(simulateSavedTimer.current);
      }
      simulateSavedTimer.current = setTimeout(() => {
        setSimulateSavedFlash(false);
        setPickerOpen(false);
      }, 450);
    },
    [applySimulateSelection, chancePct, randomErrorChance],
  );

  const cycleChance = () => {
    const idx = CHANCE_STEPS.indexOf(chancePct);
    const next = CHANCE_STEPS[(idx + 1) % CHANCE_STEPS.length] ?? 50;
    setRandomErrorChance(next / 100);
  };

  const runBusy = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const onWipeServer = () => {
    Alert.alert('Wipe server reports?', 'Deletes all reports on the API.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Wipe',
        style: 'destructive',
        onPress: () => {
          void runBusy(async () => {
            const result = await deleteReportsAction();
            Alert.alert(
              result.ok ? 'Done' : 'Failed',
              result.ok
                ? `Removed ${result.removedReports} report(s).`
                : result.message,
            );
          });
        },
      },
    ]);
  };

  const onClearLocal = () => {
    Alert.alert('Clear saved uploads and logs?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void runBusy(async () => {
            const [queue, logs] = await Promise.all([
              clearLocalUploadQueueAction(),
              clearSyncLogsAction(),
            ]);
            const message =
              queue.ok && logs.ok
                ? 'Saved uploads and logs cleared.'
                : !queue.ok
                  ? queue.message
                  : !logs.ok
                    ? logs.message
                    : 'Clear failed';
            Alert.alert(queue.ok && logs.ok ? 'Done' : 'Failed', message);
          });
        },
      },
    ]);
  };

  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader title="Test tools" showBack />
      <KeyboardAwareScrollView
        mode="insets"
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
      >
        <AppText variant={TextVariant.Caption} color="textSoft">
          For demo and review — not for field use.
        </AppText>

        <Section title="Network profile">
          {NETWORK_PROFILE_OPTIONS.map((option, index) => {
            const selected = networkProfile === option.value;
            const last = index === NETWORK_PROFILE_OPTIONS.length - 1;
            return (
              <Row
                key={option.value}
                label={option.label}
                detail={option.hint}
                last={last}
                right={<Radio selected={selected} />}
                onPress={() =>
                  setNetworkProfile(option.value as NetworkProfile)
                }
              />
            );
          })}
        </Section>

        <Section title="API simulate">
          <Row
            label="Active simulation"
            detail="How the Field Reports API fails"
            onPress={() => {
              setSimulateSavedFlash(false);
              setPickerOpen(true);
            }}
            last={!forceRandomErrors}
            right={
              <AppText variant={TextVariant.Label} color="primary">
                {activeLabel}
              </AppText>
            }
          />
          {forceRandomErrors ? (
            <Row
              label="Random chance"
              detail="Tap to cycle 25% → 50% → 75% → 100%"
              onPress={cycleChance}
              last
              right={
                <AppText variant={TextVariant.Label} color="primary">
                  {chancePct}%
                </AppText>
              }
            />
          ) : null}
        </Section>

        <Section title="Client delay">
          <View style={styles.chipBlock}>
            <AppText variant={TextVariant.Body} color="text">
              Extra wait before API calls
            </AppText>
            <View style={styles.chips}>
              {LATENCY_PRESETS_MS.map((ms) => {
                const selected =
                  networkProfile === 'off' && clientLatencyMs === ms;
                return (
                  <Pressable
                    key={ms}
                    onPress={() => setClientLatencyMs(ms)}
                    style={[styles.chip, selected && styles.chipOn]}
                  >
                    <AppText
                      variant={TextVariant.Caption}
                      color={selected ? 'white' : 'text'}
                    >
                      {ms === 0 ? '0 ms' : `${ms} ms`}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        <Section title="Upload chunk size">
          {UPLOAD_CHUNK_OPTIONS.map((option) => {
            const selected =
              !customSelected && uploadChunkBytes === option.value;
            return (
              <Row
                key={option.value}
                label={option.label}
                detail={option.hint}
                right={<Radio selected={selected} />}
                onPress={() => setUploadChunkBytes(option.value)}
              />
            );
          })}
          <Row
            label="Custom"
            detail="Enter 1–512 KB"
            last={!customSelected}
            right={<Radio selected={customSelected} />}
            onPress={() => {
              const kb = Math.max(
                1,
                Math.min(
                  512,
                  Number.parseInt(customChunkKbDraft, 10) ||
                    CUSTOM_CHUNK_DEFAULT_KB,
                ),
              );
              setCustomChunkKbDraft(String(kb));
              setUploadChunkBytes(clampCustomChunkBytes(kb * 1024));
            }}
          />
          {customSelected ? (
            <View style={styles.customChunkBlock}>
              <View style={styles.customChunkRow}>
                <AppText
                  variant={TextVariant.Body}
                  color="text"
                  style={styles.flex}
                >
                  Chunk size (KB)
                </AppText>
                <TextInput
                  value={customChunkKbDraft}
                  onChangeText={(text) => {
                    setChunkSavedFlash(false);
                    const digits = text.replace(/[^\d]/g, '').slice(0, 3);
                    setCustomChunkKbDraft(digits);
                  }}
                  onBlur={() => {
                    if (chunkDirty) {
                      applyCustomChunkKb(customChunkKbDraft);
                    }
                  }}
                  onSubmitEditing={() =>
                    applyCustomChunkKb(customChunkKbDraft)
                  }
                  keyboardType="number-pad"
                  style={styles.customChunkInput}
                  placeholder="1–512"
                  placeholderTextColor={colors.mutedSoft}
                  selectTextOnFocus
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    chunkDirty ? 'Save chunk size' : 'Chunk size saved'
                  }
                  disabled={!chunkDirty && !chunkSavedFlash}
                  onPress={() => applyCustomChunkKb(customChunkKbDraft)}
                  style={({ pressed }) => [
                    styles.customChunkApply,
                    (!chunkDirty || chunkSavedFlash) &&
                      styles.customChunkApplyMuted,
                    pressed && chunkDirty && styles.pressed,
                  ]}
                >
                  <Check
                    size={18}
                    color={
                      !chunkDirty || chunkSavedFlash
                        ? colors.textSoft
                        : colors.white
                    }
                    strokeWidth={2.5}
                  />
                </Pressable>
              </View>
              {chunkSavedFlash ? (
                <AppText
                  variant={TextVariant.Caption}
                  color="statusDeliveredText"
                >
                  Saved
                </AppText>
              ) : chunkDirty ? (
                <AppText variant={TextVariant.Caption} color="textSoft">
                  Tap ✓ to save
                </AppText>
              ) : (
                <AppText variant={TextVariant.Caption} color="textSoft">
                  Using {savedCustomKb} KB chunks
                </AppText>
              )}
            </View>
          ) : null}
        </Section>

        <Section title="One-shot">
          <Row
            label="Fail next API call"
            detail="Forces one 500, then turns itself off"
            last
            right={
              <Switch
                value={failNextRequest}
                onValueChange={setFailNextRequest}
                trackColor={{
                  true: colors.primary,
                  false: colors.borderStrong,
                }}
              />
            }
          />
        </Section>

        <Section title="Reset">
          <Row
            label="Wipe server reports"
            detail="DELETE /api/reports"
            onPress={onWipeServer}
            disabled={busy}
          />
          <Row
            label="Clear saved uploads + logs"
            detail="Removes local queue data on this device"
            onPress={onClearLocal}
            disabled={busy}
            last
          />
        </Section>
      </KeyboardAwareScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.pickerOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerOpen(false)}
            accessibilityLabel="Dismiss"
          />
          <View
            style={[
              styles.pickerSheet,
              {
                maxHeight: sheetMaxHeight,
                marginBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.pickerHeader}>
              <AppText variant={TextVariant.Label} color="white">
                Simulate failures
              </AppText>
            </View>
            <FlatList
              data={pickerOptions}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.pickerList}
              renderItem={({ item, index }) => {
                const selected =
                  item.kind === 'random'
                    ? forceRandomErrors
                    : !forceRandomErrors && simulateMode === item.mode;
                const last = index === pickerOptions.length - 1;
                return (
                  <Row
                    label={item.label}
                    detail={item.hint}
                    last={last}
                    right={<Radio selected={selected} />}
                    onPress={() => selectOption(item)}
                  />
                );
              }}
            />
            <View style={styles.pickerFooter}>
              <Pressable
                onPress={() => {
                  setSimulateSavedFlash(false);
                  setPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.pickerFooterBtn,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant={TextVariant.Caption} color="textSoft">
                  Cancel
                </AppText>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSimulateSavedFlash(true);
                  if (simulateSavedTimer.current) {
                    clearTimeout(simulateSavedTimer.current);
                  }
                  simulateSavedTimer.current = setTimeout(() => {
                    setSimulateSavedFlash(false);
                    setPickerOpen(false);
                  }, 350);
                }}
                style={({ pressed }) => [
                  styles.pickerDone,
                  simulateSavedFlash && styles.pickerDoneMuted,
                  pressed && !simulateSavedFlash && styles.pressed,
                ]}
              >
                {simulateSavedFlash ? (
                  <Check size={16} color={colors.textSoft} strokeWidth={2.5} />
                ) : (
                  <AppText variant={TextVariant.Caption} color="white">
                    Done
                  </AppText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <GlobalLoader visible={busy} message="Working…" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    padding: 16,
    gap: 18,
  },
  chipBlock: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 32, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pickerSheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  pickerHeader: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.footerBar,
    backgroundColor: colors.header,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  pickerFooterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pickerDone: {
    marginLeft: 'auto',
    minWidth: 64,
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  pickerDoneMuted: {
    backgroundColor: colors.border,
  },
  customChunkBlock: {
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  customChunkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customChunkInput: {
    ...typography[TextVariant.Body],
    width: 88,
    height: 40,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    paddingHorizontal: 10,
    paddingVertical: 0,
    textAlign: 'right',
    textAlignVertical: 'center',
  },
  customChunkApply: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  customChunkApplyMuted: {
    backgroundColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
});
