import type { FraudAlertRepository } from '../repositories/fraud-alert.repository';
import { UpdateFraudAlertStatusInput } from '../repositories/fraud-alert.repository';
import type { FraudInvestigationRepository } from '../repositories/fraud-investigation.repository';
import { CreateFraudInvestigationInput } from '../repositories/fraud-investigation.repository';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import { FraudAlertStatus, FraudInvestigationAction, FraudSeverity } from '@finguard/shared';
import { AppError } from '../errors/app-error';
import { StatusCodes } from 'http-status-codes';

export class FraudInvestigationService {
  constructor(
    private readonly alertRepo: FraudAlertRepository,
    private readonly investigationRepo: FraudInvestigationRepository,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  async startReview(alertId: string, investigatorId: string, requestId: string): Promise<void> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert)
      throw new AppError({
        code: 'FRAUD_ALERT_NOT_FOUND',
        message: 'Fraud alert not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    if (alert.status !== FraudAlertStatus.OPEN) {
      throw new AppError({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot start review for alert in status ${alert.status}`,
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    await this.alertRepo.updateStatus(alertId, {
      status: FraudAlertStatus.UNDER_REVIEW,
      reviewedBy: investigatorId,
    });

    await this.investigationRepo.create({
      fraudAlertId: alertId,
      investigatorId,
      action: FraudInvestigationAction.START_REVIEW,
      notes: 'Review started',
    });

    await this.auditLogRepo.create({
      userId: investigatorId,
      action: 'FRAUD_REVIEW_STARTED',
      resourceType: 'FraudAlert',
      resourceId: alertId,
      ipAddress: 'system',
      requestId,
      metadata: { status: FraudAlertStatus.UNDER_REVIEW },
    });
  }

  async confirmFraud(
    alertId: string,
    investigatorId: string,
    notes: string,
    requestId: string,
  ): Promise<void> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert)
      throw new AppError({
        code: 'FRAUD_ALERT_NOT_FOUND',
        message: 'Fraud alert not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    if (alert.status !== FraudAlertStatus.UNDER_REVIEW) {
      throw new AppError({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot confirm fraud for alert in status ${alert.status}`,
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    await this.alertRepo.updateStatus(alertId, {
      status: FraudAlertStatus.CONFIRMED_FRAUD,
      reviewedBy: investigatorId,
      resolutionReason: notes,
    });

    await this.investigationRepo.create({
      fraudAlertId: alertId,
      investigatorId,
      action: FraudInvestigationAction.CONFIRM_FRAUD,
      notes,
    });

    await this.auditLogRepo.create({
      userId: investigatorId,
      action: 'FRAUD_CONFIRMED',
      resourceType: 'FraudAlert',
      resourceId: alertId,
      ipAddress: 'system',
      requestId,
      metadata: {
        fraudScore: alert.fraudScore,
        severity: alert.severity,
        status: FraudAlertStatus.CONFIRMED_FRAUD,
      },
    });
  }

  async markFalsePositive(
    alertId: string,
    investigatorId: string,
    notes: string,
    requestId: string,
  ): Promise<void> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert)
      throw new AppError({
        code: 'FRAUD_ALERT_NOT_FOUND',
        message: 'Fraud alert not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    if (alert.status !== FraudAlertStatus.UNDER_REVIEW) {
      throw new AppError({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot mark as false positive for alert in status ${alert.status}`,
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    await this.alertRepo.updateStatus(alertId, {
      status: FraudAlertStatus.FALSE_POSITIVE,
      reviewedBy: investigatorId,
      resolutionReason: notes,
    });

    await this.investigationRepo.create({
      fraudAlertId: alertId,
      investigatorId,
      action: FraudInvestigationAction.MARK_FALSE_POSITIVE,
      notes,
    });

    await this.auditLogRepo.create({
      userId: investigatorId,
      action: 'FRAUD_FALSE_POSITIVE',
      resourceType: 'FraudAlert',
      resourceId: alertId,
      ipAddress: 'system',
      requestId,
      metadata: {
        fraudScore: alert.fraudScore,
        severity: alert.severity,
        status: FraudAlertStatus.FALSE_POSITIVE,
      },
    });
  }

  async resolveAlert(
    alertId: string,
    investigatorId: string,
    notes: string,
    requestId: string,
  ): Promise<void> {
    const alert = await this.alertRepo.findById(alertId);
    if (!alert)
      throw new AppError({
        code: 'FRAUD_ALERT_NOT_FOUND',
        message: 'Fraud alert not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    if (alert.status !== FraudAlertStatus.UNDER_REVIEW) {
      throw new AppError({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot resolve alert in status ${alert.status}`,
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    await this.alertRepo.updateStatus(alertId, {
      status: FraudAlertStatus.RESOLVED,
      reviewedBy: investigatorId,
      resolutionReason: notes,
    });

    await this.investigationRepo.create({
      fraudAlertId: alertId,
      investigatorId,
      action: FraudInvestigationAction.RESOLVE,
      notes,
    });

    await this.auditLogRepo.create({
      userId: investigatorId,
      action: 'FRAUD_ALERT_RESOLVED',
      resourceType: 'FraudAlert',
      resourceId: alertId,
      ipAddress: 'system',
      requestId,
      metadata: {
        fraudScore: alert.fraudScore,
        severity: alert.severity,
        status: FraudAlertStatus.RESOLVED,
      },
    });
  }
}
