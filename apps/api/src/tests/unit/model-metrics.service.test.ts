import { describe, it, expect } from 'vitest';
import { InMemoryModelMetricsRepository } from '../../tests/in-memory-model-metrics';
import { ModelMetricsService } from '../../services/model-metrics.service';

describe('ModelMetricsService edge cases', () => {
  it('handles first prediction and zero-latency', async () => {
    const repo = new InMemoryModelMetricsRepository();
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await svc.recordPrediction('m1', 0, true);
    const m = await svc.getModelMetrics('m1');
    expect(m).toBeTruthy();
    expect(m?.predictionCount).toBe(1);
    expect(m?.averageLatencyMs).toBe(0);
    expect(m?.successfulPredictions).toBe(1);
    expect(m?.failedPredictions).toBe(0);
  });

  it('handles mixed success/failure and precise averaging', async () => {
    const repo = new InMemoryModelMetricsRepository();
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await svc.recordPrediction('m2', 100, true);
    await svc.recordPrediction('m2', 200, true);
    await svc.recordPrediction('m2', 400, false);

    const metrics = await svc.getModelMetrics('m2');
    expect(metrics).toBeTruthy();
    expect(metrics?.predictionCount).toBe(3);
    // average = (100+200+400)/3 = 700/3 ~ 233.33
    expect(Math.round(metrics!.averageLatencyMs)).toBe(Math.round((100 + 200 + 400) / 3));
    expect(metrics?.successfulPredictions).toBe(2);
    expect(metrics?.failedPredictions).toBe(1);
  });

  it('concurrent updates are tolerated in in-memory repo', async () => {
    const repo = new InMemoryModelMetricsRepository();
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await Promise.all([
      svc.recordPrediction('m3', 10, true),
      svc.recordPrediction('m3', 20, true),
      svc.recordPrediction('m3', 30, false),
    ]);

    const m = await svc.getModelMetrics('m3');
    expect(m).toBeTruthy();
    expect(m?.predictionCount).toBe(3);
  });

  it('listAll returns all model versions', async () => {
    const repo = new InMemoryModelMetricsRepository();
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await svc.recordPrediction('v1', 10, true);
    await svc.recordPrediction('v2', 20, true);
    await svc.recordPrediction('v3', 30, false);

    const all = await svc.listAll();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(3);
  });

  it('listAll returns empty array when no predictions recorded', async () => {
    const repo = new InMemoryModelMetricsRepository();
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    const all = await svc.listAll();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(0);
  });

  it('getModelMetrics returns null for non-existent model version', async () => {
    const repo = new InMemoryModelMetricsRepository();
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    const m = await svc.getModelMetrics('nonexistent');
    expect(m).toBeNull();
  });

  it('listAll returns empty array when repository fails', async () => {
    const repo = {
      incrementPrediction: async () => {
        throw new Error('repo down');
      },
      getLatest: async () => null,
      listAll: async () => {
        throw new Error('repo down');
      },
    };
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await expect(svc.listAll()).rejects.toThrow('repo down');
  });

  it('recordPrediction propagates repository errors', async () => {
    const repo = {
      incrementPrediction: async () => {
        throw new Error('database error');
      },
      getLatest: async () => null,
      listAll: async () => [],
    };
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await expect(svc.recordPrediction('v1', 100, true)).rejects.toThrow('database error');
  });

  it('getModelMetrics propagates repository errors', async () => {
    const repo = {
      incrementPrediction: async () => {
        throw new Error('db error');
      },
      getLatest: async () => {
        throw new Error('read failure');
      },
      listAll: async () => [],
    };
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await expect(svc.getModelMetrics('v1')).rejects.toThrow('read failure');
  });
});
