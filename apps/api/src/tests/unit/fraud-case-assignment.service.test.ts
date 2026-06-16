import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudCaseAssignmentService } from '../../services/fraud-case-assignment.service';
import {
  FraudCaseStatus,
  FraudCasePriority,
  FraudCaseEventType,
  FraudOwnerRole,
} from '@finguard/shared';
import { AppError } from '../../errors/app-error';

describe('FraudCaseAssignmentService', () => {
  let assignmentService: FraudCaseAssignmentService;
  let mockCaseRepo: any;
  let mockEventRepo: any;
  let mockAuditRepo: any;
  let mockEscalationService: any;

  beforeEach(() => {
    mockCaseRepo = {
      findById: vi.fn(),
      assignCase: vi.fn(),
    };
    mockEventRepo = {
      create: vi.fn(),
    };
    mockAuditRepo = {
      create: vi.fn(),
    };
    mockEscalationService = {
      validateTransition: vi.fn(),
    };

    assignmentService = new FraudCaseAssignmentService(
      mockCaseRepo,
      mockEventRepo,
      mockAuditRepo,
      mockEscalationService,
    );
  });

  describe('assignCase', () => {
    it('should assign a case and log events', async () => {
      mockCaseRepo.findById.mockResolvedValue({ caseId: 'FC-1', status: FraudCaseStatus.OPEN });

      await assignmentService.assignCase(
        'FC-1',
        'inv-1',
        'admin-1',
        FraudOwnerRole.INVESTIGATOR,
        'req-1',
      );

      expect(mockEscalationService.validateTransition).toHaveBeenCalledWith(
        FraudCaseStatus.OPEN,
        FraudCaseStatus.ASSIGNED,
      );
      expect(mockCaseRepo.assignCase).toHaveBeenCalledWith(
        'FC-1',
        expect.objectContaining({
          assignedTo: 'inv-1',
          currentOwnerRole: FraudOwnerRole.INVESTIGATOR,
          status: FraudCaseStatus.ASSIGNED,
        }),
      );
      expect(mockEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: FraudCaseEventType.CASE_ASSIGNED,
        }),
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FRAUD_CASE_ASSIGNED',
        }),
      );
    });
  });

  describe('reassignCase', () => {
    it('should reassign a case and log events', async () => {
      mockCaseRepo.findById.mockResolvedValue({
        caseId: 'FC-1',
        status: FraudCaseStatus.ASSIGNED,
        assignedTo: 'inv-1',
      });

      await assignmentService.reassignCase(
        'FC-1',
        'inv-2',
        'admin-1',
        FraudOwnerRole.SENIOR_INVESTIGATOR,
        'req-1',
      );

      expect(mockCaseRepo.assignCase).toHaveBeenCalledWith(
        'FC-1',
        expect.objectContaining({
          assignedTo: 'inv-2',
          currentOwnerRole: FraudOwnerRole.SENIOR_INVESTIGATOR,
        }),
      );
      expect(mockEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: FraudCaseEventType.CASE_REASSIGNED,
        }),
      );
    });

    it('should not allow reassignment of closed cases', async () => {
      mockCaseRepo.findById.mockResolvedValue({ caseId: 'FC-1', status: FraudCaseStatus.CLOSED });

      await expect(
        assignmentService.reassignCase(
          'FC-1',
          'inv-2',
          'admin-1',
          FraudOwnerRole.INVESTIGATOR,
          'req-1',
        ),
      ).rejects.toThrow(AppError);
    });
  });

  describe('autoAssignCase', () => {
    it('should auto-assign CRITICAL cases to SENIOR_INVESTIGATOR', async () => {
      mockCaseRepo.findById.mockResolvedValue({
        caseId: 'FC-1',
        status: FraudCaseStatus.OPEN,
        priority: FraudCasePriority.CRITICAL,
      });

      await assignmentService.autoAssignCase('FC-1', 'req-1');

      expect(mockCaseRepo.assignCase).toHaveBeenCalledWith(
        'FC-1',
        expect.objectContaining({
          assignedTo: 'sys-senior-inv-1',
          currentOwnerRole: FraudOwnerRole.SENIOR_INVESTIGATOR,
        }),
      );
    });

    it('should leave LOW priority cases unassigned', async () => {
      mockCaseRepo.findById.mockResolvedValue({
        caseId: 'FC-1',
        status: FraudCaseStatus.OPEN,
        priority: FraudCasePriority.LOW,
      });

      await assignmentService.autoAssignCase('FC-1', 'req-1');

      expect(mockCaseRepo.assignCase).not.toHaveBeenCalled();
    });
  });
});
