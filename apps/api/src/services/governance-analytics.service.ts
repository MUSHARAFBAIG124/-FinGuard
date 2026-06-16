import type { ModelRegistryRepository } from '../repositories/model-registry.repository';
import type { ModelDriftRepository } from '../repositories/model-drift.repository';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import { ModelStatus, DriftLevel } from '@finguard/shared';

export interface ModelStats {
  readonly totalModels: number;
  readonly approvedModels: number;
  readonly rejectedModels: number;
  readonly retiredModels: number;
  readonly activeModels: number;
}

export interface PerformanceAnalytics {
  readonly averageAccuracy: number;
  readonly averagePrecision: number;
  readonly averageRecall: number;
  readonly averageF1: number;
  readonly averageRocAuc: number;
}

export interface FeatureDrift {
  readonly feature: string;
  readonly criticalEvents: number;
}

export interface DriftStats {
  readonly totalDriftRecords: number;
  readonly criticalDriftEvents: number;
  readonly highDriftEvents: number;
  readonly mediumDriftEvents: number;
  readonly lowDriftEvents: number;
  readonly topDriftedFeatures: FeatureDrift[];
}

export interface DriftTrends {
  readonly last7Days: number;
  readonly last30Days: number;
  readonly last90Days: number;
}

export interface GovernanceHealth {
  readonly governanceHealthScore: number;
}

export interface GovernanceSummary {
  readonly models: ModelStats;
  readonly performance: PerformanceAnalytics;
  readonly drift: DriftStats;
  readonly trends: DriftTrends;
  readonly health: GovernanceHealth;
}

export class GovernanceAnalyticsService {
  constructor(
    private readonly registryRepository: ModelRegistryRepository,
    private readonly driftRepository: ModelDriftRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  public async getModelStatistics(): Promise<ModelStats> {
    const allModels = await this.registryRepository.listAll();
    
    const approved = allModels.filter(m => m.status === ModelStatus.APPROVED).length;
    const rejected = allModels.filter(m => m.status === ModelStatus.REJECTED).length;
    const retired = allModels.filter(m => m.status === ModelStatus.RETIRED).length;
    
    // Active Model Rule: status === APPROVED and not retired
    // Since status is a single value, if it's APPROVED, it can't be RETIRED simultaneously.
    // However, we check if there is any specific 'retired' flag if it existed.
    // In our current schema, status is the source of truth.
    const active = allModels.filter(m => m.status === ModelStatus.APPROVED).length;

    return {
      totalModels: allModels.length,
      approvedModels: approved,
      rejectedModels: rejected,
      retiredModels: retired,
      activeModels: active,
    };
  }

  public async getPerformanceAnalytics(): Promise<PerformanceAnalytics> {
    const approvedModels = await this.registryRepository.findByStatus(ModelStatus.APPROVED);
    
    if (approvedModels.length === 0) {
      return {
        averageAccuracy: 0,
        averagePrecision: 0,
        averageRecall: 0,
        averageF1: 0,
        averageRocAuc: 0,
      };
    }

    const sum = approvedModels.reduce((acc, m) => ({
      accuracy: acc.accuracy + m.accuracy,
      precision: acc.precision + m.precision,
      recall: acc.recall + m.recall,
      f1: acc.f1 + m.f1Score,
      rocAuc: acc.rocAuc + m.rocAuc,
    }), { accuracy: 0, precision: 0, recall: 0, f1: 0, rocAuc: 0 });

    const count = approvedModels.length;

    return {
      averageAccuracy: Math.round((sum.accuracy / count) * 10000) / 10000,
      averagePrecision: Math.round((sum.precision / count) * 10000) / 10000,
      averageRecall: Math.round((sum.recall / count) * 10000) / 10000,
      averageF1: Math.round((sum.f1 / count) * 10000) / 10000,
      averageRocAuc: Math.round((sum.rocAuc / count) * 10000) / 10000,
    };
  }

  public async getDriftStatistics(): Promise<DriftStats> {
    const allDrift = await this.driftRepository.listRecent(1000);
    
    const counts = {
      LOW: allDrift.filter(r => r.driftLevel === DriftLevel.LOW).length,
      MEDIUM: allDrift.filter(r => r.driftLevel === DriftLevel.MEDIUM).length,
      HIGH: allDrift.filter(r => r.driftLevel === DriftLevel.HIGH).length,
      CRITICAL: allDrift.filter(r => r.driftLevel === DriftLevel.CRITICAL).length,
    };

    const featureMap: Record<string, number> = {};
    allDrift.forEach(r => {
      if (r.driftLevel === DriftLevel.CRITICAL) {
        featureMap[r.featureName] = (featureMap[r.featureName] || 0) + 1;
      }
    });

    const topDriftedFeatures = Object.entries(featureMap)
      .map(([feature, criticalEvents]) => ({ feature, criticalEvents }))
      .sort((a, b) => b.criticalEvents - a.criticalEvents)
      .slice(0, 5);

    return {
      totalDriftRecords: allDrift.length,
      lowDriftEvents: counts.LOW,
      mediumDriftEvents: counts.MEDIUM,
      highDriftEvents: counts.HIGH,
      criticalDriftEvents: counts.CRITICAL,
      topDriftedFeatures,
    };
  }

  public async getTrendAnalytics(): Promise<DriftTrends> {
    const now = new Date();
    
    const getCountForDays = async (days: number) => {
      const date = new Date();
      date.setDate(now.getDate() - days);
      return this.driftRepository.countSince(date);
    };

    const [last7, last30, last90] = await Promise.all([
      getCountForDays(7),
      getCountForDays(30),
      getCountForDays(90),
    ]);

    return {
      last7Days: last7,
      last30Days: last30,
      last90Days: last90,
    };
  }

  public async calculateGovernanceHealthScore(): Promise<GovernanceHealth> {
    const modelStats = await this.getModelStatistics();
    const driftStats = await this.getDriftStatistics();

    let score = 100;

    // Penalties
    score -= modelStats.rejectedModels * 5;
    score -= driftStats.criticalDriftEvents * 10;
    score -= driftStats.highDriftEvents * 2;

    return {
      governanceHealthScore: Math.max(0, Math.min(100, score)),
    };
  }

  public async getGovernanceSummary(): Promise<GovernanceSummary> {
    const [models, performance, drift, trends, health] = await Promise.all([
      this.getModelStatistics(),
      this.getPerformanceAnalytics(),
      this.getDriftStatistics(),
      this.getTrendAnalytics(),
      this.calculateGovernanceHealthScore(),
    ]);

    return {
      models,
      performance,
      drift,
      trends,
      health,
    };
  }

  public async logAnalyticsView(userId: string, endpoint: string, requestId: string): Promise<void> {
    await this.auditLogRepository.create({
      userId,
      action: 'GOVERNANCE_ANALYTICS_VIEWED',
      resourceType: 'GovernanceAnalytics',
      resourceId: endpoint,
      ipAddress: 'system',
      requestId,
      metadata: { endpoint, timestamp: new Date().toISOString() },
    });
  }
}
