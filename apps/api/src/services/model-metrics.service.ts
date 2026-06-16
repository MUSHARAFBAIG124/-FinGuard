import type { ModelMetricsRepository } from '../repositories/model-metrics.repository';

export interface ModelMetricsServiceDependencies {
  readonly modelMetricsRepository: ModelMetricsRepository;
}

export class ModelMetricsService {
  public constructor(private readonly deps: ModelMetricsServiceDependencies) {}

  public async recordPrediction(modelVersion: string, latencyMs: number, success: boolean) {
    return this.deps.modelMetricsRepository.incrementPrediction(modelVersion, latencyMs, success);
  }

  public async getModelMetrics(modelVersion: string) {
    return this.deps.modelMetricsRepository.getLatest(modelVersion);
  }

  public async listAll() {
    return this.deps.modelMetricsRepository.listAll();
  }
}
