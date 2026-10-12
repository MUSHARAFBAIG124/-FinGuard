import { describe, expect, it } from 'vitest';

import { parseEnv } from './env';

const validEnv = {
  NODE_ENV: 'test',
  APP_NAME: 'FinGuard AI',
  API_PORT: '4000',
  API_BASE_URL: 'http://localhost:4000',
  WEB_BASE_URL: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://localhost:27017/finguard_ai_test',
  JWT_ACCESS_SECRET: 'test-access-secret-for-phase-two',
  JWT_REFRESH_SECRET: 'test-refresh-secret-for-phase-two',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
  PASSWORD_RESET_TTL_MINUTES: '15',
  EMAIL_VERIFICATION_TTL_HOURS: '24',
  CSRF_COOKIE_NAME: 'finguard_csrf',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX: '100',
  AI_SERVICE_BASE_URL: 'http://localhost:8000',
  AI_HEALTH_TIMEOUT_MS: '100',
};

describe('environment validation', () => {
  it('accepts a valid API environment', () => {
    expect(parseEnv(validEnv)).toMatchObject({
      NODE_ENV: 'test',
      API_PORT: 4000,
      API_HOST: '127.0.0.1',
      RATE_LIMIT_MAX: 100,
      AI_HEALTH_TIMEOUT_MS: 100,
    });
  });

  it('prefers the platform PORT over the legacy API_PORT setting', () => {
    expect(
      parseEnv({
        ...validEnv,
        API_PORT: '4000',
        PORT: '10000',
      }).API_PORT,
    ).toBe(10000);
  });

  it('defaults to port 4000 when neither PORT nor API_PORT is provided', () => {
    const { API_PORT: _apiPort, ...environmentWithoutPorts } = validEnv;
    expect(parseEnv(environmentWithoutPorts).API_PORT).toBe(4000);
  });

  it('defaults the API listener to loopback and accepts a configured Render host', () => {
    expect(parseEnv(validEnv).API_HOST).toBe('127.0.0.1');
    expect(parseEnv({ ...validEnv, API_HOST: '0.0.0.0' }).API_HOST).toBe('0.0.0.0');
  });

  it('rejects invalid ports and URLs', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        API_PORT: '70000',
        WEB_BASE_URL: 'not-a-url',
      }),
    ).toThrow();
  });

  it('rejects placeholder production JWT secrets', () => {
    expect(() =>
      parseEnv({
        ...validEnv,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'replace-with-strong-access-token-secret',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });
});
