import type { ModelRegistryRepository } from '../repositories/model-registry.repository';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import { ModelStatus } from '@finguard/shared';
import { AppError } from '../errors/app-error';

export interface RegisterModelInput {
  readonly modelVersion: string;
  readonly modelType: string;
  readonly trainedBy: string;
  readonly accuracy: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
  readonly rocAuc: number;
  readonly datasetName: string;
  readonly datasetSize: number;
}

export interface ApprovalThresholds {
  readonly accuracy: number;
  readonly f1: number;
  readonly rocAuc: number;
}

export const DEFAULT_THRESHOLDS: ApprovalThresholds = {
  accuracy: 0.75,
  f1: 0.8,
  rocAuc: 0.75,
};

export class ModelGovernanceService {
  constructor(
    private readonly registryRepository: ModelRegistryRepository,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly thresholds: ApprovalThresholds = DEFAULT_THRESHOLDS,
  ) {}

  private validateTransition(currentStatus: ModelStatus, nextStatus: ModelStatus): void {
    const allowedTransitions: Record<ModelStatus, ModelStatus[]> = {
      [ModelStatus.TRAINING]: [ModelStatus.VALIDATION],
      [ModelStatus.VALIDATION]: [ModelStatus.APPROVED, ModelStatus.REJECTED],
      [ModelStatus.APPROVED]: [ModelStatus.RETIRED],
      [ModelStatus.REJECTED]: [],
      [ModelStatus.RETIRED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      throw new AppError({
        message: `Invalid status transition from ${currentStatus} to ${nextStatus}`,
        statusCode: 400,
        code: 'INVALID_STATE_TRANSITION',
      });
    }
  }

  public async registerModel(input: RegisterModelInput): Promise<{
    id: string;
    modelVersion: string;
    status: ModelStatus;
  }> {
    const existing = await this.registryRepository.findByVersion(input.modelVersion);
    if (existing) {
      throw new AppError({
        message: `Model version ${input.modelVersion} already exists`,
        statusCode: 409,
        code: 'MODEL_VERSION_EXISTS',
      });
    }

    const model = await this.registryRepository.create({
      ...input,
      status: ModelStatus.VALIDATION,
    });

    await this.auditLogRepository.create({
      userId: input.trainedBy,
      action: 'MODEL_REGISTERED',
      resourceType: 'ModelRegistry',
      resourceId: input.modelVersion,
      ipAddress: 'system',
      requestId: `model-reg-${input.modelVersion}`,
      metadata: {
        modelVersion: input.modelVersion,
        modelType: input.modelType,
        accuracy: input.accuracy,
        f1Score: input.f1Score,
        rocAuc: input.rocAuc,
      },
    });

    return {
      id: model._id.toString(),
      modelVersion: input.modelVersion,
      status: ModelStatus.VALIDATION,
    };
  }

  public async approveModel(
    version: string,
    approvedBy: string,
    reason: string,
  ): Promise<{ id: string; status: ModelStatus }> {
    const model = await this.registryRepository.findByVersion(version);
    if (!model) {
      throw new AppError({
        message: `Model version ${version} not found`,
        statusCode: 404,
        code: 'MODEL_NOT_FOUND',
      });
    }

    this.validateTransition(model.status as ModelStatus, ModelStatus.APPROVED);

    if (model.accuracy < this.thresholds.accuracy) {
      throw new AppError({
        message: `Accuracy ${model.accuracy} below threshold ${this.thresholds.accuracy}`,
        statusCode: 400,
        code: 'APPROVAL_THRESHOLD_NOT_MET',
      });
    }

    if (model.f1Score < this.thresholds.f1) {
      throw new AppError({
        message: `F1 ${model.f1Score} below threshold ${this.thresholds.f1}`,
        statusCode: 400,
        code: 'APPROVAL_THRESHOLD_NOT_MET',
      });
    }

    if (model.rocAuc < this.thresholds.rocAuc) {
      throw new AppError({
        message: `ROC AUC ${model.rocAuc} below threshold ${this.thresholds.rocAuc}`,
        statusCode: 400,
        code: 'APPROVAL_THRESHOLD_NOT_MET',
      });
    }

    const updated = await this.registryRepository.approve(version, approvedBy, reason);
    if (!updated) {
      throw new AppError({
        message: `Failed to approve model ${version}`,
        statusCode: 500,
        code: 'APPROVAL_FAILED',
      });
    }

    await this.auditLogRepository.create({
      userId: approvedBy,
      action: 'MODEL_APPROVED',
      resourceType: 'ModelRegistry',
      resourceId: version,
      ipAddress: 'system',
      requestId: `model-approve-${version}`,
      metadata: {
        modelVersion: version,
        accuracy: model.accuracy,
        f1Score: model.f1Score,
        rocAuc: model.rocAuc,
        reason,
      },
    });

    return { id: updated._id.toString(), status: ModelStatus.APPROVED };
  }

  public async rejectModel(
    version: string,
    rejectedBy: string,
    reason: string,
  ): Promise<{ id: string; status: ModelStatus }> {
    const model = await this.registryRepository.findByVersion(version);
    if (!model) {
      throw new AppError({
        message: `Model version ${version} not found`,
        statusCode: 404,
        code: 'MODEL_NOT_FOUND',
      });
    }

    this.validateTransition(model.status as ModelStatus, ModelStatus.REJECTED);

    const updated = await this.registryRepository.reject(version, rejectedBy, reason);
    if (!updated) {
      throw new AppError({
        message: `Failed to reject model ${version}`,
        statusCode: 500,
        code: 'REJECTION_FAILED',
      });
    }

    await this.auditLogRepository.create({
      userId: rejectedBy,
      action: 'MODEL_REJECTED',
      resourceType: 'ModelRegistry',
      resourceId: version,
      ipAddress: 'system',
      requestId: `model-reject-${version}`,
      metadata: { modelVersion: version, reason },
    });

    return { id: updated._id.toString(), status: ModelStatus.REJECTED };
  }

  public async retireModel(
    version: string,
    retiredBy: string,
    reason: string,
  ): Promise<{ id: string; status: ModelStatus }> {
    const model = await this.registryRepository.findByVersion(version);
    if (!model) {
      throw new AppError({
        message: `Model version ${version} not found`,
        statusCode: 404,
        code: 'MODEL_NOT_FOUND',
      });
    }

    this.validateTransition(model.status as ModelStatus, ModelStatus.RETIRED);

    const updated = await this.registryRepository.retire(version, retiredBy, reason);
    if (!updated) {
      throw new AppError({
        message: `Failed to retire model ${version}`,
        statusCode: 500,
        code: 'RETIREMENT_FAILED',
      });
    }

    await this.auditLogRepository.create({
      userId: retiredBy,
      action: 'MODEL_RETIRED',
      resourceType: 'ModelRegistry',
      resourceId: version,
      ipAddress: 'system',
      requestId: `model-retire-${version}`,
      metadata: { modelVersion: version, reason },
    });

    return { id: updated._id.toString(), status: ModelStatus.RETIRED };
  }

  public async listModels(): Promise<
    readonly {
      id: string;
      modelVersion: string;
      modelType: string;
      accuracy: number;
      f1Score: number;
      rocAuc: number;
      status: ModelStatus;
      approved: boolean;
      approvedBy?: string;
      approvedAt?: string;
      createdAt: string;
    }[]
  > {
    const models = await this.registryRepository.listAll();
    return models.map((m) => ({
      id: m._id.toString(),
      modelVersion: m.modelVersion,
      modelType: m.modelType,
      accuracy: m.accuracy,
      f1Score: m.f1Score,
      rocAuc: m.rocAuc,
      status: m.status as ModelStatus,
      approved: m.approved,
      approvedBy: m.approvedBy?.toString(),
      approvedAt: m.approvedAt?.toISOString(),
      createdAt: m.createdAt?.toISOString?.() ?? '',
    }));
  }

  public async getModelDetails(version: string): Promise<{
    id: string;
    modelVersion: string;
    modelType: string;
    trainedBy: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    rocAuc: number;
    datasetName: string;
    datasetSize: number;
    status: ModelStatus;
    approved: boolean;
    approvedBy?: string;
    approvedAt?: string;
    createdAt: string;
  } | null> {
    const model = await this.registryRepository.findByVersion(version);
    if (!model) return null;

    return {
      id: model._id.toString(),
      modelVersion: model.modelVersion,
      modelType: model.modelType,
      trainedBy: model.trainedBy.toString(),
      accuracy: model.accuracy,
      precision: model.precision,
      recall: model.recall,
      f1Score: model.f1Score,
      rocAuc: model.rocAuc,
      datasetName: model.datasetName,
      datasetSize: model.datasetSize,
      status: model.status as ModelStatus,
      approved: model.approved,
      approvedBy: model.approvedBy?.toString(),
      approvedAt: model.approvedAt?.toISOString(),
      createdAt: model.createdAt?.toISOString?.() ?? '',
    };
  }
}
