import axios, {
  type AxiosError,
  type AxiosRequestConfig,
} from 'axios';
import { ResultAsync } from 'neverthrow';

import { type AppError } from '../errors/AppError';
import { mapAxiosError } from '../errors/mapAxiosError';
import { env } from './env';

const http = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeout,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
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
