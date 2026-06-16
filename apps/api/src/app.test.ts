import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApp } from './app';

interface HealthResponseBody {
  data: {
    status: string;
    service?: string;
    dependency?: string;
    phase?: string;
    connectionState?: string;
    dependencies?: {
      mongodb: {
        required: boolean;
      };
      aiService: {
        required: boolean;
      };
    };
  };
  meta: {
    requestId: string;
  };
}

interface ErrorResponseBody {
  error: {
    code: string;
  };
  meta: {
    requestId: string;
  };
}

describe('api app infrastructure', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns liveness with the standard envelope and request id header', async () => {
    const response = await request(createApp())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'phase-2-request')
      .expect(200);
    const body = response.body as HealthResponseBody;

    expect(response.headers['x-request-id']).toBe('phase-2-request');
    expect(body.meta.requestId).toBe('phase-2-request');
    expect(body.data).toMatchObject({
      status: 'ok',
      service: 'finguard-api',
    });
  });

  it('returns readiness with Mongo as required and AI as optional', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    const response = await request(createApp()).get('/api/v1/health/ready').expect(200);
    const body = response.body as HealthResponseBody;

    expect(body.data.status).toBe('degraded');
    expect(body.data.dependencies?.mongodb.required).toBe(true);
    expect(body.data.dependencies?.aiService.required).toBe(false);
  });

  it('returns database dependency health separately', async () => {
    const response = await request(createApp()).get('/api/v1/health/db').expect(200);
    const body = response.body as HealthResponseBody;

    expect(body.data).toMatchObject({
      dependency: 'mongodb',
      connectionState: 'disconnected',
      status: 'unavailable',
    });
  });

  it('returns AI dependency health without crashing when unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    const response = await request(createApp()).get('/api/v1/health/ai').expect(200);
    const body = response.body as HealthResponseBody;

    expect(body.data).toMatchObject({
      dependency: 'ai-service',
      phase: 'planned-phase-6',
      status: 'unavailable',
    });
  });

  it('sets security headers', async () => {
    const response = await request(createApp()).get('/api/v1/health/live').expect(200);

    expect(response.headers['x-dns-prefetch-control']).toBe('off');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('returns standard 404 envelope for unknown routes', async () => {
    const response = await request(createApp()).get('/api/v1/missing').expect(404);
    const body = response.body as ErrorResponseBody;

    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(body.meta.requestId).toBeTruthy();
  });
});
