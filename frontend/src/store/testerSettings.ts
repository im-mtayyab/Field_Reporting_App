import { create } from 'zustand';

import { appStorage } from './mmkv';

/** Mirrors backend `X-Simulate` modes (+ none). */
export type SimulateMode =
  | 'none'
  | 'latency'
  | 'drop'
  | 'hang'
  | 'timeout'
  | 'reject'
  | '500';

export type NetworkProfile = 'off' | 'slow3g' | 'fast3g' | 'poorWifi';

export const SIMULATE_MODE_OPTIONS: Array<{
  value: SimulateMode;
  label: string;
  hint: string;
}> = [
  { value: 'none', label: 'None', hint: 'Normal responses' },
  { value: 'latency', label: 'Latency', hint: 'Server delays 1.5-4s' },
  { value: 'drop', label: 'Drop', hint: 'Connection destroyed mid-request' },
  { value: 'hang', label: 'Hang', hint: 'Response never comes' },
  { value: 'timeout', label: 'Timeout', hint: '504 after ~35s' },
  { value: 'reject', label: 'Reject', hint: '422 non-retryable' },
  { value: '500', label: 'Server 500', hint: 'Retryable internal error' },
];

export const NETWORK_PROFILE_OPTIONS: Array<{
  value: NetworkProfile;
  label: string;
  hint: string;
  latencyMs: number;
  randomChance: number;
}> = [
  {
    value: 'off',
    label: 'Off',
    hint: 'No extra client delay',
    latencyMs: 0,
    randomChance: 0,
  },
  {
    value: 'slow3g',
    label: 'Slow 3G',
    hint: '~2s delay before each API call',
    latencyMs: 2000,
    randomChance: 0,
  },
  {
    value: 'fast3g',
    label: 'Fast 3G',
    hint: '~750ms delay before each API call',
    latencyMs: 750,
    randomChance: 0,
  },
  {
    value: 'poorWifi',
    label: 'Poor Wi‑Fi',
    hint: '~400ms delay + 25% random API failures',
    latencyMs: 400,
    randomChance: 0.25,
  },
];

export const LATENCY_PRESETS_MS = [0, 500, 1500, 3000] as const;

/** 0 = Auto (single PATCH of remaining bytes). */
export const UPLOAD_CHUNK_OPTIONS: Array<{
  value: number;
  label: string;
  hint: string;
}> = [
  {
    value: 0,
    label: 'Auto',
    hint: 'One PATCH for the whole photo (default)',
  },
  {
    value: 256 * 1024,
    label: '256 KB',
    hint: 'Small chunks — easier pause/drop mid-file',
  },
  {
    value: 512 * 1024,
    label: '512 KB',
    hint: 'Medium chunks',
  },
  {
    value: 1024 * 1024,
    label: '1 MB',
    hint: 'Larger chunks, fewer requests',
  },
  {
    value: 2 * 1024 * 1024,
    label: '2 MB',
    hint: 'Few PATCHes on ≤5 MB photos',
  },
];

type TesterSettingsState = {
  simulateMode: SimulateMode;
  /** Extra client-side delay (ms) before every API call. */
  clientLatencyMs: number;
  networkProfile: NetworkProfile;
  /** When on, each request randomly picks a failure mode. */
  forceRandomErrors: boolean;
  randomErrorChance: number;
  /** Next API call gets a forced failure, then clears. */
  failNextRequest: boolean;
  /**
   * Max TUS PATCH body size in bytes. 0 = Auto (entire remaining file).
   */
  uploadChunkBytes: number;
  /** Persist sync events to local SQLite. */
  saveSyncLogs: boolean;
  /**
   * When true, upload every ready photo on a report at once.
   * When false, upload one photo at a time (default).
   */
  parallelUploads: boolean;
  setSimulateMode: (mode: SimulateMode) => void;
  setClientLatencyMs: (ms: number) => void;
  setNetworkProfile: (profile: NetworkProfile) => void;
  setForceRandomErrors: (on: boolean) => void;
  setRandomErrorChance: (chance: number) => void;
  setFailNextRequest: (on: boolean) => void;
  setUploadChunkBytes: (bytes: number) => void;
  setSaveSyncLogs: (on: boolean) => void;
  setParallelUploads: (on: boolean) => void;
  /** Apply simulate selection in one store write (faster UI). */
  applySimulateSelection: (input: {
    mode: SimulateMode | 'random';
    randomChance?: number;
  }) => void;
};

const KEYS = {
  mode: 'tester.simulateMode',
  latency: 'tester.clientLatencyMs',
  profile: 'tester.networkProfile',
  random: 'tester.forceRandomErrors',
  chance: 'tester.randomErrorChance',
  failNext: 'tester.failNextRequest',
  chunk: 'tester.uploadChunkBytes',
  saveLogs: 'tester.saveSyncLogs',
  parallel: 'tester.parallelUploads',
} as const;

function readMode(): SimulateMode {
  const value = appStorage.getString(KEYS.mode);
  if (SIMULATE_MODE_OPTIONS.some((o) => o.value === value)) {
    return value as SimulateMode;
  }
  return 'none';
}

function readProfile(): NetworkProfile {
  const value = appStorage.getString(KEYS.profile);
  if (NETWORK_PROFILE_OPTIONS.some((o) => o.value === value)) {
    return value as NetworkProfile;
  }
  return 'off';
}

/** Clamp a custom chunk size to 1–512 KB (bytes). */
export function clampCustomChunkBytes(bytes: number): number {
  const rounded = Math.round(bytes);
  return Math.max(1024, Math.min(512 * 1024, rounded));
}

export function isPresetUploadChunk(bytes: number): boolean {
  return UPLOAD_CHUNK_OPTIONS.some((option) => option.value === bytes);
}

function readChunkBytes(): number {
  const value = appStorage.getNumber(KEYS.chunk);
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  if (isPresetUploadChunk(value)) {
    return value;
  }
  // Persisted custom value (1–512 KB).
  return clampCustomChunkBytes(value);
}

export const useTesterSettings = create<TesterSettingsState>((set, get) => ({
  simulateMode: readMode(),
  clientLatencyMs: appStorage.getNumber(KEYS.latency) ?? 0,
  networkProfile: readProfile(),
  forceRandomErrors: appStorage.getBoolean(KEYS.random) ?? false,
  randomErrorChance: appStorage.getNumber(KEYS.chance) ?? 0.35,
  failNextRequest: appStorage.getBoolean(KEYS.failNext) ?? false,
  uploadChunkBytes: readChunkBytes(),
  saveSyncLogs: appStorage.getBoolean(KEYS.saveLogs) ?? true,
  parallelUploads: appStorage.getBoolean(KEYS.parallel) ?? false,

  setSimulateMode: (mode) => {
    appStorage.set(KEYS.mode, mode);
    set({ simulateMode: mode });
  },
  setClientLatencyMs: (ms) => {
    const next = Math.max(0, Math.min(60_000, Math.round(ms)));
    appStorage.set(KEYS.latency, next);
    set({ clientLatencyMs: next, networkProfile: 'off' });
    appStorage.set(KEYS.profile, 'off');
  },
  setNetworkProfile: (profile) => {
    const option =
      NETWORK_PROFILE_OPTIONS.find((item) => item.value === profile) ??
      NETWORK_PROFILE_OPTIONS[0]!;
    appStorage.set(KEYS.profile, option.value);
    appStorage.set(KEYS.latency, option.latencyMs);
    const patch: Partial<TesterSettingsState> = {
      networkProfile: option.value,
      clientLatencyMs: option.latencyMs,
    };
    if (option.randomChance > 0) {
      appStorage.set(KEYS.random, true);
      appStorage.set(KEYS.chance, option.randomChance);
      patch.forceRandomErrors = true;
      patch.randomErrorChance = option.randomChance;
    } else if (get().forceRandomErrors && get().networkProfile === 'poorWifi') {
      // Leaving poor Wi‑Fi turns random off unless user set it elsewhere.
      appStorage.set(KEYS.random, false);
      patch.forceRandomErrors = false;
    }
    set(patch);
  },
  setForceRandomErrors: (on) => {
    appStorage.set(KEYS.random, on);
    set({ forceRandomErrors: on });
  },
  setRandomErrorChance: (chance) => {
    const next = Math.max(0, Math.min(1, chance));
    appStorage.set(KEYS.chance, next);
    set({ randomErrorChance: next });
  },
  setFailNextRequest: (on) => {
    appStorage.set(KEYS.failNext, on);
    set({ failNextRequest: on });
  },
  setUploadChunkBytes: (bytes) => {
    let next = 0;
    if (bytes <= 0) {
      next = 0;
    } else if (isPresetUploadChunk(bytes)) {
      next = bytes;
    } else {
      next = clampCustomChunkBytes(bytes);
    }
    appStorage.set(KEYS.chunk, next);
    set({ uploadChunkBytes: next });
  },
  setSaveSyncLogs: (on) => {
    appStorage.set(KEYS.saveLogs, on);
    set({ saveSyncLogs: on });
  },
  setParallelUploads: (on) => {
    appStorage.set(KEYS.parallel, on);
    set({ parallelUploads: on });
  },
  applySimulateSelection: ({ mode, randomChance }) => {
    if (mode === 'random') {
      const chance = randomChance ?? Math.max(get().randomErrorChance, 0.5);
      appStorage.set(KEYS.random, true);
      appStorage.set(KEYS.chance, chance);
      set({ forceRandomErrors: true, randomErrorChance: chance });
      return;
    }
    appStorage.set(KEYS.random, false);
    appStorage.set(KEYS.mode, mode);
    set({ forceRandomErrors: false, simulateMode: mode });
  },
}));

export function isSyncLoggingEnabled(): boolean {
  return useTesterSettings.getState().saveSyncLogs;
}

const RANDOM_MODES: SimulateMode[] = [
  'latency',
  'drop',
  'hang',
  'timeout',
  'reject',
  '500',
];

/** Resolve header value for the next outbound API call. */
export function resolveSimulateHeader(): SimulateMode | null {
  const state = useTesterSettings.getState();

  if (state.failNextRequest) {
    useTesterSettings.getState().setFailNextRequest(false);
    return '500';
  }

  if (state.forceRandomErrors && Math.random() < state.randomErrorChance) {
    return RANDOM_MODES[Math.floor(Math.random() * RANDOM_MODES.length)]!;
  }

  if (state.simulateMode !== 'none') {
    return state.simulateMode;
  }

  return null;
}

export function getClientLatencyMs(): number {
  return useTesterSettings.getState().clientLatencyMs;
}

/** 0 means Auto — send remaining bytes in one PATCH. */
export function getUploadChunkBytes(): number {
  return useTesterSettings.getState().uploadChunkBytes;
}

export function getParallelUploadsEnabled(): boolean {
  return useTesterSettings.getState().parallelUploads;
}
