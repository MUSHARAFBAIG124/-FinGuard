import type {
  ModelDriftRepository,
  CreateDriftRecordInput,
} from '../repositories/model-drift.repository';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import { DriftLevel } from '@finguard/shared';

export interface FeatureDistribution {
  readonly featureName: string;
  readonly trainingMean: number;
  readonly trainingStd: number;
  readonly trainingSize: number;
  readonly productionMean: number;
  readonly productionStd: number;
  readonly productionSize: number;
  readonly trainingHistogram: number[];
  readonly productionHistogram: number[];
}

export interface DriftResult {
  readonly featureName: string;
  readonly driftScore: number;
  readonly driftLevel: DriftLevel;
  readonly trainingMean: number;
  readonly productionMean: number;
}

export class DriftDetectionService {
  constructor(
    private readonly driftRepository: ModelDriftRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  public calculatePSI(
    trainingHistogram: number[],
    productionHistogram: number[],
    bins: number = 10,
  ): number {
    let psi = 0;
    const epsilon = 1e-6;

    for (let i = 0; i < bins; i++) {
      const p = (trainingHistogram[i] ?? 0) + epsilon;
      const q = (productionHistogram[i] ?? 0) + epsilon;
      const ratio = p / q;
      psi += (p - q) * Math.log(ratio);
    }

    return psi;
  }

  public classifyDrift(psi: number): DriftLevel {
    if (psi < 0.1) return DriftLevel.LOW;
    if (psi < 0.25) return DriftLevel.MEDIUM;
    if (psi < 0.5) return DriftLevel.HIGH;
    return DriftLevel.CRITICAL;
  }

  public computeHistogram(data: number[], bins: number = 10): number[] {
    if (data.length === 0) return new Array(bins).fill(0);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const binWidth = range / bins;
    const histogram = new Array(bins).fill(0);

    for (const value of data) {
      let binIndex = Math.floor((value - min) / binWidth);
      if (binIndex >= bins) binIndex = bins - 1;
      if (binIndex < 0) binIndex = 0;
      histogram[binIndex]++;
    }

    const total = data.length;
    return histogram.map((h) => h / total);
  }

  public async analyzeDrift(
    modelVersion: string,
    features: FeatureDistribution[],
  ): Promise<DriftResult[]> {
    const results: DriftResult[] = [];

    for (const feature of features) {
      const driftScore = this.calculatePSI(feature.trainingHistogram, feature.productionHistogram);

      const driftLevel = this.classifyDrift(driftScore);

      const result: DriftResult = {
        featureName: feature.featureName,
        driftScore,
        driftLevel,
        trainingMean: feature.trainingMean,
        productionMean: feature.productionMean,
      };

      results.push(result);

      const input: CreateDriftRecordInput = {
        modelVersion,
        featureName: feature.featureName,
        trainingMean: feature.trainingMean,
        productionMean: feature.productionMean,
        driftScore,
        driftLevel,
      };

      await this.driftRepository.create(input);
    }

    try {
      await this.auditLogRepository.create({
        userId: 'system',
        action: 'MODEL_DRIFT_DETECTED',
        resourceType: 'ModelDrift',
        resourceId: modelVersion,
        ipAddress: 'system',
        requestId: `drift-check-${modelVersion}-${Date.now()}`,
        metadata: {
          modelVersion,
          featuresAnalyzed: features.length,
          criticalDrifts: results.filter((r) => r.driftLevel === DriftLevel.CRITICAL).length,
          highDrifts: results.filter((r) => r.driftLevel === DriftLevel.HIGH).length,
        },
      });
    } catch {
      // non-critical audit log — skip if userId validation fails
    }

    return results;
  }

  public async getDriftRecords(modelVersion?: string): Promise<
    readonly {
      id: string;
      modelVersion: string;
      featureName: string;
      trainingMean: number;
      productionMean: number;
      driftScore: number;
      driftLevel: DriftLevel;
      detectedAt: string;
    }[]
  > {
    const records = modelVersion
      ? await this.driftRepository.listByModelVersion(modelVersion)
      : await this.driftRepository.listRecent();

    return records.map((r) => ({
      id: r._id.toString(),
      modelVersion: r.modelVersion,
      featureName: r.featureName,
      trainingMean: r.trainingMean,
      productionMean: r.productionMean,
      driftScore: r.driftScore,
      driftLevel: r.driftLevel as DriftLevel,
      detectedAt: r.detectedAt instanceof Date ? r.detectedAt.toISOString() : String(r.detectedAt),
    }));
  }

  public async getCriticalDriftRecords(): Promise<
    readonly {
      id: string;
      modelVersion: string;
      featureName: string;
      trainingMean: number;
      productionMean: number;
      driftScore: number;
      driftLevel: DriftLevel;
      detectedAt: string;
    }[]
  > {
    const records = await this.driftRepository.listCritical();
    return records.map((r) => ({
      id: r._id.toString(),
      modelVersion: r.modelVersion,
      featureName: r.featureName,
      trainingMean: r.trainingMean,
      productionMean: r.productionMean,
      driftScore: r.driftScore,
      driftLevel: r.driftLevel as DriftLevel,
      detectedAt: r.detectedAt instanceof Date ? r.detectedAt.toISOString() : String(r.detectedAt),
    }));
  }
}
