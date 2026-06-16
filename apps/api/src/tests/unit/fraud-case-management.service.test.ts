import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudCaseManagementService } from '../../services/fraud-case-management.service';
import { FraudCaseStatus, FraudCaseEventType, FraudCasePriority } from '@finguard/shared';

describe('FraudCaseManagementService', () => {
  let managementService: FraudCaseManagementService;
  let mockCaseRepo: any;
  let mockEventRepo: any;
  let mockAuditRepo: any;
  let mockEscalationService: any;
  let mockAssignmentService: any;
  let mockSlaService: any;

  beforeEach(() => {
    mockCaseRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      updateStatus: vi.fn(),
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
    mockAssignmentService = {
      autoAssignCase: vi.fn(),
    };
    mockSlaService = {
      calculateDueDate: vi.fn().mockReturnValue(new Date()),
    };

    managementService = new FraudCaseManagementService(
      mockCaseRepo,
      mockEventRepo,
      mockAuditRepo,
      mockEscalationService,
      mockAssignmentService,
      mockSlaService,
    );
  });

  describe('createCase', () => {
    it('should create a case, log events, and trigger auto-assign', async () => {
      mockCaseRepo.create.mockResolvedValue({ caseId: 'FC-1', priority: FraudCasePriority.MEDIUM });

      await managementService.createCase('ALERT-1', 'user-1', FraudCasePriority.MEDIUM, 'req-1');

      expect(mockCaseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fraudAlertId: 'ALERT-1',
          userId: 'user-1',
          priority: FraudCasePriority.MEDIUM,
        }),
      );
      expect(mockEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: FraudCaseEventType.CASE_CREATED,
        }),
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FRAUD_CASE_CREATED',
        }),
      );
      expect(mockAssignmentService.autoAssignCase).toHaveBeenCalledWith('FC-1', 'req-1');
    });
  });

  describe('resolveCase', () => {
    it('should resolve a case', async () => {
      mockCaseRepo.findById.mockResolvedValue({
        caseId: 'FC-1',
        status: FraudCaseStatus.UNDER_INVESTIGATION,
      });

      await managementService.resolveCase('FC-1', 'inv-1', 'False positive', 'req-1');

      expect(mockEscalationService.validateTransition).toHaveBeenCalledWith(
        FraudCaseStatus.UNDER_INVESTIGATION,
        FraudCaseStatus.RESOLVED,
      );
      expect(mockCaseRepo.updateStatus).toHaveBeenCalledWith(
        'FC-1',
        expect.objectContaining({
          status: FraudCaseStatus.RESOLVED,
          resolutionReason: 'False positive',
        }),
      );
      expect(mockEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: FraudCaseEventType.CASE_RESOLVED,
        }),
      );
    });
  });

  describe('closeCase', () => {
    it('should close a case', async () => {
      mockCaseRepo.findById.mockResolvedValue({ caseId: 'FC-1', status: FraudCaseStatus.RESOLVED });

      await managementService.closeCase('FC-1', 'admin-1', 'Archived', 'req-1');

      expect(mockCaseRepo.updateStatus).toHaveBeenCalledWith(
        'FC-1',
        expect.objectContaining({
          status: FraudCaseStatus.CLOSED,
        }),
      );
      expect(mockEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: FraudCaseEventType.CASE_CLOSED,
        }),
      );
    });
  });
});
