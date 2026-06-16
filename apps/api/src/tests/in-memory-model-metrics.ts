import type { ModelMetricsDocument } from '../models/model-metrics.model';
import type { ModelMetricsRepository } from '../repositories/model-metrics.repository';

export class InMemoryModelMetricsRepository implements ModelMetricsRepository {
  private store: Record<string, ModelMetricsDocument> = {} as any;

  public async incrementPrediction(modelVersion: string, latencyMs: number, success: boolean) {
    const existing = this.store[modelVersion];
    if (!existing) {
      const doc = {
        modelVersion,
        predictionCount: 1,
        successfulPredictions: success ? 1 : 0,
        failedPredictions: success ? 0 : 1,
        averageLatencyMs: latencyMs,
        lastPredictionAt: new Date(),
        save: async () => {},
      } as unknown as ModelMetricsDocument;
      this.store[modelVersion] = doc;
      return doc;
    }

    const count = existing.predictionCount + 1;
    const prevAvg = existing.averageLatencyMs ?? 0;
    const newAvg = (prevAvg * existing.predictionCount + latencyMs) / count;
    existing.predictionCount = count;
    existing.successfulPredictions = existing.successfulPredictions + (success ? 1 : 0);
    existing.failedPredictions = existing.failedPredictions + (success ? 0 : 1);
    existing.averageLatencyMs = newAvg;
    existing.lastPredictionAt = new Date();
    return existing;
  }

  public async getLatest(modelVersion: string) {
    return this.store[modelVersion] ?? null;
  }

  public async listAll() {
    return Object.values(this.store);
  }
}
