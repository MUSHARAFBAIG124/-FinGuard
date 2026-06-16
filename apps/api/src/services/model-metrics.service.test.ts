import { describe, it, expect } from 'vitest';
import { ModelMetricsService } from './model-metrics.service';
import { InMemoryModelMetricsRepository } from '../tests/in-memory-model-metrics';

describe('ModelMetricsService', () => {
  it('increments metrics and computes average latency', async () => {
    const repo = new InMemoryModelMetricsRepository();
    const svc = new ModelMetricsService({ modelMetricsRepository: repo });

    await svc.recordPrediction('1.0.0', 100, true);
    await svc.recordPrediction('1.0.0', 200, false);
    const m = await svc.getModelMetrics('1.0.0');
    expect(m).not.toBeNull();
    expect(m?.predictionCount).toBe(2);
    expect(m?.successfulPredictions).toBe(1);
    expect(m?.failedPredictions).toBe(1);
    expect(m?.averageLatencyMs).toBeGreaterThanOrEqual(100);
  });
});
