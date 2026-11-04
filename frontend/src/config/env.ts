import Config from 'react-native-config';

const timeoutRaw = Number(Config.API_TIMEOUT);
const configuredUrl = (Config.API_URL ?? '').trim();

export const env = {
  // Config can be ""; strip trailing / so axios paths join cleanly.
  apiUrl: (configuredUrl || 'http://localhost:4000').replace(/\/$/, ''),
  apiTimeout:
    Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 30_000,
};
