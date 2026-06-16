import { MongooseModelMetricsRepository } from '../repositories/model-metrics.repository';
import { MongooseModelRegistryRepository } from '../repositories/model-registry.repository';
import { MongooseModelDriftRepository } from '../repositories/model-drift.repository';
import { MongooseAuditLogRepository } from '../repositories/audit-log.repository';
import { ModelMetricsService } from './model-metrics.service';
import { ModelGovernanceService } from './model-governance.service';
import { DriftDetectionService } from './drift-detection.service';
import { GovernanceAnalyticsService } from './governance-analytics.service';

export const createModelDependencies = () => {
  const modelMetricsRepository = new MongooseModelMetricsRepository();
  const modelMetricsService = new ModelMetricsService({ modelMetricsRepository });

  const modelRegistryRepository = new MongooseModelRegistryRepository();
  const modelDriftRepository = new MongooseModelDriftRepository();
  const auditLogRepository = new MongooseAuditLogRepository();

  const governanceService = new ModelGovernanceService(modelRegistryRepository, auditLogRepository);
  const driftService = new DriftDetectionService(modelDriftRepository, auditLogRepository);
  const analyticsService = new GovernanceAnalyticsService(
    modelRegistryRepository,
    modelDriftRepository,
    auditLogRepository,
  );

  return {
    modelMetricsService,
    governanceService,
    driftService,
    analyticsService,
  };
};

export type ModelDependencies = ReturnType<typeof createModelDependencies>;
