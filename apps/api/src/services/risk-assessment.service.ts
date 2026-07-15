import type {
  RiskAssessmentRepository,
  CreateRiskAssessmentInput,
} from '../repositories/risk-assessment.repository';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors/app-error';
import { RiskCategory } from '@finguard/shared';
import type { ModelMetricsService } from './model-metrics.service';

export interface RiskAssessmentServiceDependencies {
  readonly riskAssessmentRepository: RiskAssessmentRepository;
  readonly auditLogRepository: AuditLogRepository;
  readonly aiServiceUrl?: string; // e.g. http://localhost:8000/api/v1
  readonly modelMetricsService?: ModelMetricsService;
}

export class RiskAssessmentService {
  public constructor(private readonly dependencies: RiskAssessmentServiceDependencies) {}

  private async callAiService(
    applicationData: any,
    userId: string,
    ipAddress: string,
    requestId?: string,
  ) {
    const base =
      this.dependencies.aiServiceUrl ??
      process.env.AI_SERVICE_URL ??
      'http://localhost:8000/api/v1';
    const url = `${base}/predict-risk`;

    // Log audit for model prediction request
    await this.dependencies.auditLogRepository
      .create({
        action: 'MODEL_PREDICTION_REQUESTED',
        resourceType: 'RiskAssessment',
        resourceId: '',
        requestId: requestId ?? '',
        userId,
        ipAddress,
        metadata: { url, applicationData },
      })
      .catch(() => undefined);

    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData),
      });
    } catch (err: any) {
      const latencyWhenFailed = Date.now() - start;
      await this.dependencies.auditLogRepository
        .create({
          action: 'MODEL_PREDICTION_FAILED',
          resourceType: 'RiskAssessment',
          resourceId: '',
          requestId: requestId ?? '',
          userId,
          ipAddress,
          metadata: {
            url,
            errorMessage: String(err?.message ?? err),
            latencyMs: latencyWhenFailed,
          },
        })
        .catch(() => undefined);
      try {
        const mm = this.dependencies.modelMetricsService;
        if (mm)
          await mm.recordPrediction('unknown', latencyWhenFailed, false).catch(() => undefined);
      } catch {}
      throw new AppError({
        code: 'AI_SERVICE_ERROR',
        message: `AI service failed: ${String(err)}`,
        statusCode: StatusCodes.SERVICE_UNAVAILABLE,
      });
    }

    if (!res.ok) {
      const latencyWhenFailed = Date.now() - start;
      await this.dependencies.auditLogRepository
        .create({
          action: 'MODEL_PREDICTION_FAILED',
          resourceType: 'RiskAssessment',
          resourceId: '',
          requestId: requestId ?? '',
          userId,
          ipAddress,
          metadata: { url, errorMessage: res.statusText, latencyMs: latencyWhenFailed },
        })
        .catch(() => undefined);
      try {
        const mm = this.dependencies.modelMetricsService;
        if (mm)
          await mm.recordPrediction('unknown', latencyWhenFailed, false).catch(() => undefined);
      } catch {}
      throw new AppError({
        code: 'AI_SERVICE_ERROR',
        message: `AI service responded ${res.status}`,
        statusCode: StatusCodes.SERVICE_UNAVAILABLE,
      });
    }

    const json = await res.json();
    const latencyMs = Date.now() - start;
    // attach latency and model version if present for callers
    json.latencyMs = latencyMs;

    await this.dependencies.auditLogRepository
      .create({
        action: 'MODEL_PREDICTION_SUCCEEDED',
        resourceType: 'RiskAssessment',
        resourceId: '',
        requestId: requestId ?? '',
        userId,
        ipAddress,
        metadata: { url, latencyMs, modelVersion: json.modelVersion ?? null },
      })
      .catch(() => undefined);

    // record metrics for success if available
    try {
      const mm = this.dependencies.modelMetricsService;
      if (mm)
        await mm
          .recordPrediction(json.modelVersion ?? 'unknown', latencyMs, true)
          .catch(() => undefined);
    } catch {}

    return json;
  }

  public async createRiskAssessment(
    loanApplicationId: string,
    applicationData: any,
    context?: { userId?: string; requestId?: string; ipAddress?: string },
  ) {
    const userId = context?.userId ?? 'unknown';
    const ipAddress = context?.ipAddress ?? '0.0.0.0';

    // call AI
    const prediction = await this.callAiService(
      applicationData,
      userId,
      ipAddress,
      context?.requestId,
    );

    // map risk category (string)
    const riskCategory =
      (prediction.riskCategory as unknown) ?? (prediction.riskCategory || 'MEDIUM');

    const input: CreateRiskAssessmentInput = {
      loanApplicationId,
      riskScore: prediction.riskScore,
      riskCategory: riskCategory,
      approvalProbability: prediction.approvalProbability,
      modelVersion: prediction.modelVersion ?? '1.0.0',
      riskEngineVersion: prediction.riskEngineVersion ?? '1.0.0',
      // persist structured explanation as-is (do not stringify)
      explanation: {
        summary: prediction.explanation?.summary,
        positiveFactors: prediction.explanation?.positiveFactors ?? [],
        negativeFactors: prediction.explanation?.negativeFactors ?? [],
        shapValues: prediction.explanation?.shapValues ?? undefined,
      },
      generatedAt: new Date(),
    };

    const created = await this.dependencies.riskAssessmentRepository.create(input);

    // Record metrics if service available
    try {
      const mm = this.dependencies.modelMetricsService;
      if (mm && typeof prediction.latencyMs === 'number') {
        await mm
          .recordPrediction(input.modelVersion, prediction.latencyMs, true)
          .catch(() => undefined);
      }
    } catch {
      // swallow
    }

    // Audit
    await this.dependencies.auditLogRepository
      .create({
        action: 'RISK_ASSESSMENT_CREATED',
        resourceType: 'RiskAssessment',
        resourceId: created._id.toString(),
        requestId: context?.requestId ?? '',
        userId,
        ipAddress,
        metadata: { loanApplicationId, input },
      })
      .catch(() => undefined);

    return created;
  }
}
