import { describe, it, expect, vi, beforeEach } from 'vitest';
// Hoist fs mock to top-level to satisfy vitest hoisting and avoid future errors.
// Tests will adjust the mocked implementation before importing the controller so
// each test gets a fresh behavior.
import * as fs from 'fs';
vi.mock('fs', () => ({ readFileSync: vi.fn(() => JSON.stringify({ modelVersion: '1.2.3' })) }));

describe('ModelController getInfo/getMetrics', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns info with metadata when file present and metrics null', async () => {
    const fakeMetricsService: any = { getModelMetrics: async () => null };
    const controller = (await import('../../controllers/model.controller')).createModelController({ modelMetricsService: fakeMetricsService });

    const req: any = { query: {} };
    let body: any = null;
    const res: any = { json: (b: any) => { body = b; return b; } };

    await controller.getInfo(req, res);
    expect(body).toBeTruthy();
    expect(body.modelVersion).toBeDefined();
  });

  it('handles missing/corrupted metadata safely via fs mock', async () => {
    // Change the hoisted mock implementation to throw before importing the controller
    (fs as any).readFileSync.mockImplementation(() => { throw new Error('no file'); });
    const { createModelController } = await import('../../controllers/model.controller');
    const fakeMetricsService: any = { getModelMetrics: async () => null };
    const controller = createModelController({ modelMetricsService: fakeMetricsService });

    const req: any = { query: {} };
    let body: any = null;
    const res: any = { json: (b: any) => { body = b; return b; } };

    await controller.getInfo(req, res);
    expect(body).toBeTruthy();
    expect(body.modelVersion).toBeDefined();
  });

  it('getMetrics returns 404 when not found and 200 when found', async () => {
    const svc: any = { getModelMetrics: async (v: string) => null };
    const controller = (await import('../../controllers/model.controller')).createModelController({ modelMetricsService: svc });
    let status = 200; let body: any = null;
    const res: any = { status: (s: number) => { status = s; return res; }, json: (b: any) => { body = b; return b; } };
    await controller.getMetrics({ query: { modelVersion: '1.2.3' } } as any, res);
    expect(status).toBe(404);

    const svc2: any = { getModelMetrics: async () => ({ modelVersion: '1.2.3', predictionCount: 1, successfulPredictions: 1, failedPredictions: 0, averageLatencyMs: 10, lastPredictionAt: new Date() }) };
    const controller2 = (await import('../../controllers/model.controller')).createModelController({ modelMetricsService: svc2 });
    status = 200; body = null;
    await controller2.getMetrics({ query: { modelVersion: '1.2.3' } } as any, res);
    expect(status).toBe(200);
    expect(body.modelVersion).toBe('1.2.3');
  });

  it('handles malformed JSON in metadata.json gracefully', async () => {
    (fs as any).readFileSync.mockImplementation(() => '{ invalid json content');
    const { createModelController } = await import('../../controllers/model.controller');
    const fakeMetricsService: any = { getModelMetrics: async () => null };
    const controller = createModelController({ modelMetricsService: fakeMetricsService });

    const req: any = { query: {} };
    let body: any = null;
    const res: any = { json: (b: any) => { body = b; return b; } };

    await controller.getInfo(req, res);
    expect(body).toBeTruthy();
    expect(body.modelVersion).toBe('unknown');
    expect(body.algorithm).toBe('unknown');
  });

  it('getInfo returns metrics when available from service', async () => {
    (fs as any).readFileSync.mockImplementation(() => JSON.stringify({ modelVersion: '2.0.0', algorithm: 'RandomForest' }));
    const fakeMetricsService: any = {
      getModelMetrics: async (v: string) => v === '2.0.0' ? { modelVersion: '2.0.0', predictionCount: 50, successfulPredictions: 45, failedPredictions: 5, averageLatencyMs: 25, lastPredictionAt: new Date() } : null
    };
    const { createModelController } = await import('../../controllers/model.controller');
    const controller = createModelController({ modelMetricsService: fakeMetricsService });

    const req: any = { query: {} };
    let body: any = null;
    const res: any = { json: (b: any) => { body = b; return b; } };

    await controller.getInfo(req, res);
    expect(body).toBeTruthy();
    expect(body.metrics).toBeTruthy();
    expect(body.metrics.predictionCount).toBe(50);
  });

  it('getInfo returns null metrics when service throws exception', async () => {
    (fs as any).readFileSync.mockImplementation(() => JSON.stringify({ modelVersion: '3.0.0' }));
    const fakeMetricsService: any = {
      getModelMetrics: async () => { throw new Error('database connection failed'); }
    };
    const { createModelController } = await import('../../controllers/model.controller');
    const controller = createModelController({ modelMetricsService: fakeMetricsService });

    const req: any = { query: {} };
    let error: any = null;
    const res: any = { json: () => {}, status: () => res };

    try {
      await controller.getInfo(req, res);
    } catch (err) {
      error = err;
    }
    expect(error).toBeTruthy();
    expect(error.message).toContain('database connection failed');
  });

  it('getMetrics handles service throwing exception', async () => {
    const svc: any = { getModelMetrics: async () => { throw new Error('service unavailable'); } };
    const controller = (await import('../../controllers/model.controller')).createModelController({ modelMetricsService: svc });

    let error: any = null;
    const res: any = { json: () => {}, status: () => res };

    try {
      await controller.getMetrics({ query: { modelVersion: '1.0.0' } } as any, res);
    } catch (err) {
      error = err;
    }
    expect(error).toBeTruthy();
    expect(error.message).toContain('service unavailable');
  });

  it('getInfo handles empty metadata file', async () => {
    (fs as any).readFileSync.mockImplementation(() => '');
    const { createModelController } = await import('../../controllers/model.controller');
    const fakeMetricsService: any = { getModelMetrics: async () => null };
    const controller = createModelController({ modelMetricsService: fakeMetricsService });

    const req: any = { query: {} };
    let body: any = null;
    const res: any = { json: (b: any) => { body = b; return b; } };

    await controller.getInfo(req, res);
    expect(body).toBeTruthy();
    expect(body.modelVersion).toBe('unknown');
  });
});
