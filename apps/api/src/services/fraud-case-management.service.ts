import { FraudCaseStatus, FraudCaseEventType, FraudCasePriority } from '@finguard/shared';
import { FraudCaseDocument } from '../models/fraud-case.model';
import { FraudCaseRepository } from '../repositories/fraud-case.repository';
import { FraudCaseEventRepository } from '../repositories/fraud-case-event.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AppError } from '../errors/app-error';
import { StatusCodes } from 'http-status-codes';
import { FraudEscalationService } from './fraud-escalation.service';
import { FraudCaseAssignmentService } from './fraud-case-assignment.service';
import { FraudSLAService } from './fraud-sla.service';

export class FraudCaseManagementService {
  constructor(
    private readonly caseRepo: FraudCaseRepository,
    private readonly eventRepo: FraudCaseEventRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly escalationService: FraudEscalationService,
    private readonly assignmentService: FraudCaseAssignmentService,
    private readonly slaService: FraudSLAService,
  ) {}

  async createCase(
    fraudAlertId: string,
    userId: string,
    priority: FraudCasePriority,
    requestId: string,
  ): Promise<FraudCaseDocument> {
    const slaDueAt = this.slaService.calculateDueDate(priority);

    const fraudCase = await this.caseRepo.create({
      fraudAlertId,
      userId,
      priority,
      slaDueAt,
    });

    await this.eventRepo.create({
      caseId: fraudCase.caseId,
      investigatorId: 'system',
      eventType: FraudCaseEventType.CASE_CREATED,
      notes: `Case created from alert ${fraudAlertId}`,
    });

    await this.auditRepo.create({
      requestId,
      ipAddress: 'system',
      userId: 'system',
      action: 'FRAUD_CASE_CREATED',
      resourceType: 'FraudCase',
      resourceId: fraudCase.caseId,
      metadata: { priority, slaDueAt },
    });

    // Attempt auto-assignment
    await this.assignmentService.autoAssignCase(fraudCase.caseId, requestId);

    return fraudCase;
  }

  async getCase(caseId: string): Promise<FraudCaseDocument> {
    const fraudCase = await this.caseRepo.findById(caseId);
    if (!fraudCase) {
      throw new AppError({
        code: 'NOT_FOUND',
        message: 'Fraud case not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }
    return fraudCase;
  }

  async listCases(filters?: any): Promise<readonly FraudCaseDocument[]> {
    return this.caseRepo.listCases(filters);
  }

  async resolveCase(
    caseId: string,
    investigatorId: string,
    resolutionReason: string,
    requestId: string,
  ): Promise<void> {
    const fraudCase = await this.getCase(caseId);
    this.escalationService.validateTransition(fraudCase.status, FraudCaseStatus.RESOLVED);

    await this.caseRepo.updateStatus(caseId, {
      status: FraudCaseStatus.RESOLVED,
      resolutionReason,
      resolvedAt: new Date(),
    });

    await this.createTimelineEvent(
      caseId,
      investigatorId,
      FraudCaseEventType.CASE_RESOLVED,
      `Resolved: ${resolutionReason}`,
    );

    await this.auditRepo.create({
      requestId,
      ipAddress: 'system',
      userId: investigatorId,
      action: 'FRAUD_CASE_RESOLVED',
      resourceType: 'FraudCase',
      resourceId: caseId,
      metadata: { resolutionReason },
    });
  }

  async closeCase(
    caseId: string,
    investigatorId: string,
    notes: string,
    requestId: string,
  ): Promise<void> {
    const fraudCase = await this.getCase(caseId);
    this.escalationService.validateTransition(fraudCase.status, FraudCaseStatus.CLOSED);

    await this.caseRepo.updateStatus(caseId, {
      status: FraudCaseStatus.CLOSED,
    });

    await this.createTimelineEvent(
      caseId,
      investigatorId,
      FraudCaseEventType.CASE_CLOSED,
      `Closed: ${notes}`,
    );

    await this.auditRepo.create({
      requestId,
      ipAddress: 'system',
      userId: investigatorId,
      action: 'FRAUD_CASE_CLOSED',
      resourceType: 'FraudCase',
      resourceId: caseId,
    });
  }

  async addComment(caseId: string, investigatorId: string, notes: string): Promise<void> {
    await this.getCase(caseId); // ensures exists
    await this.createTimelineEvent(caseId, investigatorId, FraudCaseEventType.COMMENT_ADDED, notes);
  }

  async createTimelineEvent(
    caseId: string,
    investigatorId: string,
    eventType: FraudCaseEventType,
    notes: string,
  ): Promise<void> {
    await this.eventRepo.create({
      caseId,
      investigatorId,
      eventType,
      notes,
    });
  }
}
