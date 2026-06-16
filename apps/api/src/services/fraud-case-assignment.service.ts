import {
  FraudCaseStatus,
  FraudCaseEventType,
  FraudCasePriority,
  FraudOwnerRole,
} from '@finguard/shared';
import { FraudCaseRepository } from '../repositories/fraud-case.repository';
import { FraudCaseEventRepository } from '../repositories/fraud-case-event.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AppError } from '../errors/app-error';
import { StatusCodes } from 'http-status-codes';
import { FraudEscalationService } from './fraud-escalation.service';

export class FraudCaseAssignmentService {
  constructor(
    private readonly caseRepo: FraudCaseRepository,
    private readonly eventRepo: FraudCaseEventRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly escalationService: FraudEscalationService,
  ) {}

  /**
   * Assigns a case to a specific investigator.
   */
  async assignCase(
    caseId: string,
    assignedTo: string,
    assignedBy: string,
    role: FraudOwnerRole,
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

    this.escalationService.validateTransition(fraudCase.status, FraudCaseStatus.ASSIGNED);

    await this.caseRepo.assignCase(caseId, {
      assignedTo,
      currentOwnerRole: role,
      assignedAt: new Date(),
      status: FraudCaseStatus.ASSIGNED,
    });

    await this.eventRepo.create({
      caseId,
      investigatorId: assignedBy,
      eventType: FraudCaseEventType.CASE_ASSIGNED,
      notes: `Assigned to ${assignedTo} (${role})`,
    });

    await this.auditRepo.create({
      requestId,
      ipAddress: 'system',
      userId: assignedBy,
      action: 'FRAUD_CASE_ASSIGNED',
      resourceType: 'FraudCase',
      resourceId: caseId,
      metadata: { assignedTo, role },
    });
  }

  /**
   * Reassigns a case from one investigator to another.
   */
  async reassignCase(
    caseId: string,
    assignedTo: string,
    assignedBy: string,
    role: FraudOwnerRole,
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

    if (
      fraudCase.status === FraudCaseStatus.CLOSED ||
      fraudCase.status === FraudCaseStatus.RESOLVED
    ) {
      throw new AppError({
        code: 'INVALID_STATE',
        message: 'Cannot reassign closed or resolved case',
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    await this.caseRepo.assignCase(caseId, {
      assignedTo,
      currentOwnerRole: role,
      assignedAt: new Date(),
      status: FraudCaseStatus.ASSIGNED,
    });

    await this.eventRepo.create({
      caseId,
      investigatorId: assignedBy,
      eventType: FraudCaseEventType.CASE_REASSIGNED,
      notes: `Reassigned from ${fraudCase.assignedTo || 'Unassigned'} to ${assignedTo} (${role})`,
    });

    await this.auditRepo.create({
      requestId,
      ipAddress: 'system',
      userId: assignedBy,
      action: 'FRAUD_CASE_REASSIGNED',
      resourceType: 'FraudCase',
      resourceId: caseId,
      metadata: { assignedTo, previousOwner: fraudCase.assignedTo },
    });
  }

  /**
   * Automatically assigns a case based on priority.
   * In a real system, this might look for available agents.
   * For now, it simply sets the required role and moves it to ASSIGNED if an agent is found,
   * or keeps it OPEN if it goes to a queue.
   */
  async autoAssignCase(caseId: string, requestId: string): Promise<void> {
    const fraudCase = await this.caseRepo.findById(caseId);
    if (!fraudCase) return;

    let targetRole: FraudOwnerRole;
    let assignedTo = '';

    switch (fraudCase.priority) {
      case FraudCasePriority.CRITICAL:
        targetRole = FraudOwnerRole.SENIOR_INVESTIGATOR;
        assignedTo = 'sys-senior-inv-1'; // Mock auto assignment
        break;
      case FraudCasePriority.HIGH:
        targetRole = FraudOwnerRole.INVESTIGATOR;
        assignedTo = 'sys-inv-1';
        break;
      case FraudCasePriority.MEDIUM:
      case FraudCasePriority.LOW:
        // Leaves it in the queue (OPEN status, no assignment)
        return;
      default:
        return;
    }

    if (assignedTo) {
      await this.assignCase(caseId, assignedTo, 'system', targetRole, requestId);
    }
  }
}
