import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudEscalationService } from '../../services/fraud-escalation.service';
import { FraudCaseStatus, FraudCasePriority, FraudCaseEventType } from '@finguard/shared';
import { AppError } from '../../errors/app-error';

describe('FraudEscalationService', () => {
  let escalationService: FraudEscalationService;
  let mockCaseRepo: any;
  let mockEventRepo: any;
  let mockAuditRepo: any;
  let mockSlaService: any;

  beforeEach(() => {
    mockCaseRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
    };
    mockEventRepo = {
      create: vi.fn(),
    };
    mockAuditRepo = {
      create: vi.fn(),
    };
    mockSlaService = {
      isBreached: vi.fn(),
    };

    escalationService = new FraudEscalationService(
      mockCaseRepo,
      mockEventRepo,
      mockAuditRepo,
      mockSlaService,
    );
  });

  describe('validateTransition', () => {
    it('should allow valid transitions', () => {
      expect(() =>
        escalationService.validateTransition(FraudCaseStatus.OPEN, FraudCaseStatus.ASSIGNED),
      ).not.toThrow();
      expect(() =>
        escalationService.validateTransition(FraudCaseStatus.ASSIGNED, FraudCaseStatus.ESCALATED),
      ).not.toThrow();
      expect(() =>
        escalationService.validateTransition(FraudCaseStatus.ESCALATED, FraudCaseStatus.RESOLVED),
      ).not.toThrow();
    });

    it('should throw AppError on invalid transitions', () => {
      expect(() =>
        escalationService.validateTransition(FraudCaseStatus.CLOSED, FraudCaseStatus.OPEN),
      ).toThrow(AppError);
      expect(() =>
        escalationService.validateTransition(
          FraudCaseStatus.OPEN,
          FraudCaseStatus.UNDER_INVESTIGATION,
        ),
      ).toThrow(AppError);
    });
  });

  describe('checkEscalationEligibility', () => {
    it('should return false if case is already escalated, resolved, or closed', async () => {
      mockCaseRepo.findById.mockResolvedValue({ status: FraudCaseStatus.ESCALATED });
      expect(await escalationService.checkEscalationEligibility('FC-1')).toBe(false);

      mockCaseRepo.findById.mockResolvedValue({ status: FraudCaseStatus.RESOLVED });
      expect(await escalationService.checkEscalationEligibility('FC-1')).toBe(false);
    });

    it('should return true for CRITICAL cases that have breached SLA', async () => {
      mockCaseRepo.findById.mockResolvedValue({
        status: FraudCaseStatus.OPEN,
        priority: FraudCasePriority.CRITICAL,
      });
      mockSlaService.isBreached.mockReturnValue(true);
      expect(await escalationService.checkEscalationEligibility('FC-1')).toBe(true);
    });

    it('should return false for LOW priority even if breached', async () => {
      mockCaseRepo.findById.mockResolvedValue({
        status: FraudCaseStatus.OPEN,
        priority: FraudCasePriority.LOW,
      });
      mockSlaService.isBreached.mockReturnValue(true);
      expect(await escalationService.checkEscalationEligibility('FC-1')).toBe(false);
    });
  });

  describe('escalateCase', () => {
    it('should escalate a valid case and log events', async () => {
      mockCaseRepo.findById.mockResolvedValue({
        caseId: 'FC-1',
        status: FraudCaseStatus.ASSIGNED,
        priority: FraudCasePriority.HIGH,
      });

      await escalationService.escalateCase('FC-1', 'inv-1', 'Needs senior review', 'req-1');

      expect(mockCaseRepo.updateStatus).toHaveBeenCalledWith('FC-1', {
        status: FraudCaseStatus.ESCALATED,
      });
      expect(mockEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: 'FC-1',
          eventType: FraudCaseEventType.CASE_ESCALATED,
          investigatorId: 'inv-1',
          notes: 'Needs senior review',
        }),
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FRAUD_CASE_ESCALATED',
          resourceId: 'FC-1',
        }),
      );
    });

    it('should fail to escalate an invalid case state', async () => {
      mockCaseRepo.findById.mockResolvedValue({
        caseId: 'FC-1',
        status: FraudCaseStatus.CLOSED,
      });

      await expect(
        escalationService.escalateCase('FC-1', 'inv-1', 'notes', 'req-1'),
      ).rejects.toThrow(AppError);
    });
  });
});
