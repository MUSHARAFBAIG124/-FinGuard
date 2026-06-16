import { describe, it, expect } from 'vitest';
import { InMemoryModelMetricsRepository } from './in-memory-model-metrics';
import { ModelMetricsService } from '../services/model-metrics.service';

describe('ModelMetricsService averaging', () => {
  it('calculates average latency correctly across multiple recordings', async () => {
    const repo = new InMemoryModelMetricsRepository();
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await svc.recordPrediction('v1', 100, true);
    await svc.recordPrediction('v1', 200, true);
    await svc.recordPrediction('v1', 300, false);

    const metrics = await svc.getModelMetrics('v1');
    expect(metrics).toBeTruthy();
    expect(metrics?.predictionCount).toBe(3);
    // average should be (100 + 200 + 300) / 3 = 200
    expect(Math.round(metrics!.averageLatencyMs)).toBe(200);
    expect(metrics?.successfulPredictions).toBe(2);
    expect(metrics?.failedPredictions).toBe(1);
  });
});
