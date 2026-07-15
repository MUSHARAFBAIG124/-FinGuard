import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';
const ACCESS_TOKEN_STORAGE_KEY = 'fg_access_token';
const USER_STORAGE_KEY = 'fg_user';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const authClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15_000,
});

const extractAccessToken = (payload: unknown): string | null => {
  const data = (payload as { data?: unknown })?.data ?? payload;
  const tokens = (data as { tokens?: { accessToken?: unknown } })?.tokens;
  const accessToken = tokens?.accessToken;

  return typeof accessToken === 'string' && accessToken.split('.').length === 3
    ? accessToken
    : null;
};

const clearStoredSession = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
};

const shouldAttemptRefresh = (
  config?: InternalAxiosRequestConfig,
): config is RetriableRequestConfig => {
  const url = config?.url ?? '';

  return (
    !!config &&
    !(config as RetriableRequestConfig)._retry &&
    !url.includes('/auth/login') &&
    !url.includes('/auth/refresh') &&
    !url.includes('/auth/logout')
  );
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 15_000,
});

let refreshPromise: Promise<string> | null = null;

// Request: attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const refreshAccessToken = async (): Promise<string> => {
  refreshPromise ??= authClient
    .post('/auth/refresh', {})
    .then((response) => {
      const accessToken = extractAccessToken(response.data);

      if (!accessToken) {
        throw new Error('Refresh response did not include a valid access token');
      }

      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
      return accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// Response: unwrap data / refresh once on expired access tokens
apiClient.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const status = error?.response?.status;

    if (status === 401 && shouldAttemptRefresh(error.config)) {
      try {
        const accessToken = await refreshAccessToken();
        error.config._retry = true;
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient.request(error.config);
      } catch (refreshError) {
        clearStoredSession();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError instanceof Error ? refreshError : error);
      }
    }

    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      clearStoredSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    if (!error?.response) {
      return Promise.reject(error);
    }
    return Promise.reject(error);
  },
);
