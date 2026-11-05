import axios, {
  type AxiosError,
  type AxiosRequestConfig,
} from 'axios';
import { ResultAsync } from 'neverthrow';

import { type AppError } from '../errors/AppError';
import { mapAxiosError } from '../errors/mapAxiosError';
import {
  getClientLatencyMs,
  resolveSimulateHeader,
} from '../store/testerSettings';
import { env } from './env';

const http = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

function isOurApiRequest(url?: string): boolean {
  if (!url) {
    return true;
  }
  if (url.startsWith('/')) {
    return true;
  }
  return url.startsWith(env.apiUrl);
}

http.interceptors.request.use(async (config) => {
  // Tester hooks only apply to Field Reports API — never to Supabase TUS.
  if (!isOurApiRequest(config.url)) {
    return config;
  }

  const latency = getClientLatencyMs();
  if (latency > 0) {
    await new Promise((resolve) => setTimeout(resolve, latency));
  }

  const simulate = resolveSimulateHeader();
  if (simulate) {
    config.headers = config.headers ?? {};
    config.headers['X-Simulate'] = simulate;
  }

  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError | AppError) => Promise.reject(mapAxiosError(error)),
);

function request<T>(config: AxiosRequestConfig): ResultAsync<T, AppError> {
  return ResultAsync.fromPromise(
    http.request<T>(config).then((res) => res.data),
    mapAxiosError,
  );
}

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'GET', url }),

  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'POST', url, data: body }),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    request<T>({ ...config, method: 'DELETE', url }),
};

export { http };
