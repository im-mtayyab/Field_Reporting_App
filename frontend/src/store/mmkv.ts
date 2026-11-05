import { createMMKV } from 'react-native-mmkv';

/** Shared MMKV instance for tester prefs and small durable flags. */
export const appStorage = createMMKV({ id: 'field-reports' });
