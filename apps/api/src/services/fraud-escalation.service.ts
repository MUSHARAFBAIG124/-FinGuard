import { FraudCaseStatus, FraudCaseEventType, FraudCasePriority } from '@finguard/shared';
import type { FraudCaseRepository } from '../repositories/fraud-case.repository';
import type { FraudCaseEventRepository } from '../repositories/fraud-case-event.repository';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import { AppError } from '../errors/app-error';
import { StatusCodes } from 'http-status-codes';
import type { FraudSLAService } from './fraud-sla.service';

export class FraudEscalationService {
  // Define valid transitions
  private static readonly VALID_TRANSITIONS: Record<FraudCaseStatus, FraudCaseStatus[]> = {
    [FraudCaseStatus.OPEN]: [
      FraudCaseStatus.ASSIGNED,
      FraudCaseStatus.RESOLVED,
      FraudCaseStatus.CLOSED,
    ],
    [FraudCaseStatus.ASSIGNED]: [
      FraudCaseStatus.UNDER_INVESTIGATION,
      FraudCaseStatus.ESCALATED,
      FraudCaseStatus.RESOLVED,
    ],
    [FraudCaseStatus.UNDER_INVESTIGATION]: [FraudCaseStatus.ESCALATED, FraudCaseStatus.RESOLVED],
    [FraudCaseStatus.ESCALATED]: [FraudCaseStatus.ASSIGNED, FraudCaseStatus.RESOLVED],
    [FraudCaseStatus.RESOLVED]: [FraudCaseStatus.CLOSED],
    [FraudCaseStatus.CLOSED]: [], // Terminal state
  };

  constructor(
    private readonly caseRepo: FraudCaseRepository,
    private readonly eventRepo: FraudCaseEventRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly slaService: FraudSLAService,
  ) {}

  /**
   * Validates if a transition from current to target status is permitted.
   */
  validateTransition(current: FraudCaseStatus, target: FraudCaseStatus): void {
    const allowed = FraudEscalationService.VALID_TRANSITIONS[current] || [];
    if (!allowed.includes(target)) {
      throw new AppError({
        code: 'INVALID_CASE_TRANSITION',
        message: `Cannot transition case from ${current} to ${target}.`,
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }
  }

  /**
   * Checks if a case is eligible for escalation based on SLA or manual rules.
   * "Critical case not reviewed within SLA."
   * "High case exceeds SLA."
   */
  async checkEscalationEligibility(caseId: string): Promise<boolean> {
    const fraudCase = await this.caseRepo.findById(caseId);
    if (!fraudCase) return false;

    // Already escalated or closed
    if (
      fraudCase.status === FraudCaseStatus.ESCALATED ||
      fraudCase.status === FraudCaseStatus.RESOLVED ||
      fraudCase.status === FraudCaseStatus.CLOSED
    ) {
      return false;
    }

    const isBreached = this.slaService.isBreached(fraudCase);

    if (fraudCase.priority === FraudCasePriority.CRITICAL && isBreached) return true;
    if (fraudCase.priority === FraudCasePriority.HIGH && isBreached) return true;

    return false;
  }

  /**
   * Escalates a case manually or automatically.
   */
  async escalateCase(
    caseId: string,
    investigatorId: string,
    notes: string,
    requestId: string,
  ): Promise<void> {
    const fraudCase = await this.caseRepo.findById(caseId);
    if (!fraudCase) {
      throw new AppError({
        code: 'NOT_FOUND',
        message: 'Fraud case not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    this.validateTransition(fraudCase.status, FraudCaseStatus.ESCALATED);

    // Update case status
    await this.caseRepo.updateStatus(caseId, {
      status: FraudCaseStatus.ESCALATED,
    });

    // Record Event
    await this.eventRepo.create({
      caseId,
      investigatorId,
      eventType: FraudCaseEventType.CASE_ESCALATED,
      notes,
    });

    // Audit Log
    await this.auditRepo.create({
      requestId,
      ipAddress: 'system',
      userId: investigatorId,
      action: 'FRAUD_CASE_ESCALATED',
      resourceType: 'FraudCase',
      resourceId: caseId,
      metadata: { priority: fraudCase.priority, previousStatus: fraudCase.status },
    });
  }
}
