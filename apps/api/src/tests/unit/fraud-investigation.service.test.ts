import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FraudInvestigationService } from '../../services/fraud-investigation.service';
import { FraudAlertStatus, FraudInvestigationAction, FraudSeverity } from '@finguard/shared';
import { AppError } from '../../errors/app-error';
import { StatusCodes } from 'http-status-codes';

describe('FraudInvestigationService', () => {
  let service: FraudInvestigationService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAlertRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockInvRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAuditRepo: any;

  beforeEach(() => {
    mockAlertRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      updateStatus: vi.fn(),
      findByUserId: vi.fn(),
      findOpenAlerts: vi.fn(),
      findCriticalAlerts: vi.fn(),
      listRecent: vi.fn(),
    };

    mockInvRepo = {
      create: vi.fn(),
      findByAlertId: vi.fn(),
      findByInvestigator: vi.fn(),
      listRecent: vi.fn(),
    };

    mockAuditRepo = {
      create: vi.fn(),
    };

    service = new FraudInvestigationService(mockAlertRepo, mockInvRepo, mockAuditRepo);
  });

  const getAlertMock = (status: FraudAlertStatus) => ({
    id: 'alert-1',
    status,
    fraudScore: 85,
    severity: FraudSeverity.CRITICAL,
    transactionId: 'tx-1',
    userId: 'user-1',
  });

  // startReview: OPEN -> UNDER_REVIEW
  describe('startReview (OPEN -> UNDER_REVIEW)', () => {
    it('transitions alert from OPEN to UNDER_REVIEW', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      await service.startReview('alert-1', 'inv-1', 'req-1');
      expect(mockAlertRepo.updateStatus).toHaveBeenCalledWith('alert-1', {
        status: FraudAlertStatus.UNDER_REVIEW,
        reviewedBy: 'inv-1',
      });
    });

    it('creates an investigation history record with START_REVIEW action', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      await service.startReview('alert-1', 'inv-1', 'req-1');
      expect(mockInvRepo.create).toHaveBeenCalledWith({
        fraudAlertId: 'alert-1',
        investigatorId: 'inv-1',
        action: FraudInvestigationAction.START_REVIEW,
        notes: 'Review started',
      });
    });

    it('creates audit log with FRAUD_REVIEW_STARTED and propagates requestId', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      await service.startReview('alert-1', 'inv-1', 'req-abc');
      expect(mockAuditRepo.create).toHaveBeenCalledTimes(1);
      expect(mockAuditRepo.create).toHaveBeenCalledWith({
        userId: 'inv-1',
        action: 'FRAUD_REVIEW_STARTED',
        resourceType: 'FraudAlert',
        resourceId: 'alert-1',
        requestId: 'req-abc',
        ipAddress: 'system',
        metadata: { status: FraudAlertStatus.UNDER_REVIEW },
      });
    });

    it('throws AppError(NOT_FOUND) when alert does not exist', async () => {
      mockAlertRepo.findById.mockResolvedValue(null);
      const err = await service.startReview('alert-1', 'inv-1', 'req-1').catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('does NOT update status when alert not found', async () => {
      mockAlertRepo.findById.mockResolvedValue(null);
      await service.startReview('alert-1', 'inv-1', 'req-1').catch(() => {});
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('[BLOCKED] CONFIRMED_FRAUD -> UNDER_REVIEW throws AppError(BAD_REQUEST)', async () => {
      mockAlertRepo.findById.mockResolvedValue(
        getAlertMock(FraudAlertStatus.CONFIRMED_FRAUD) as any,
      );
      const err = await service.startReview('alert-1', 'inv-1', 'req-1').catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('[BLOCKED] FALSE_POSITIVE -> UNDER_REVIEW throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(
        getAlertMock(FraudAlertStatus.FALSE_POSITIVE) as any,
      );
      await expect(service.startReview('alert-1', 'inv-1', 'req-1')).rejects.toBeInstanceOf(
        AppError,
      );
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('[BLOCKED] RESOLVED -> UNDER_REVIEW throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.RESOLVED) as any);
      await expect(service.startReview('alert-1', 'inv-1', 'req-1')).rejects.toBeInstanceOf(
        AppError,
      );
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('[BLOCKED] UNDER_REVIEW -> UNDER_REVIEW throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await expect(service.startReview('alert-1', 'inv-1', 'req-1')).rejects.toBeInstanceOf(
        AppError,
      );
    });

    it('propagates repository errors from findById', async () => {
      mockAlertRepo.findById.mockRejectedValue(new Error('DB Error'));
      await expect(service.startReview('alert-1', 'inv-1', 'req-1')).rejects.toThrow('DB Error');
    });

    it('propagates errors from updateStatus', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      mockAlertRepo.updateStatus.mockRejectedValue(new Error('Update failed'));
      await expect(service.startReview('alert-1', 'inv-1', 'req-1')).rejects.toThrow(
        'Update failed',
      );
    });

    it('propagates audit repository errors', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      mockAuditRepo.create.mockRejectedValue(new Error('Audit DB failure'));
      await expect(service.startReview('alert-1', 'inv-1', 'req-1')).rejects.toThrow(
        'Audit DB failure',
      );
    });
  });

  // confirmFraud: UNDER_REVIEW -> CONFIRMED_FRAUD
  describe('confirmFraud (UNDER_REVIEW -> CONFIRMED_FRAUD)', () => {
    it('transitions alert from UNDER_REVIEW to CONFIRMED_FRAUD', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.confirmFraud('alert-1', 'inv-1', 'Confirm reason', 'req-1');
      expect(mockAlertRepo.updateStatus).toHaveBeenCalledWith('alert-1', {
        status: FraudAlertStatus.CONFIRMED_FRAUD,
        reviewedBy: 'inv-1',
        resolutionReason: 'Confirm reason',
      });
    });

    it('creates investigation history with CONFIRM_FRAUD action', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.confirmFraud('alert-1', 'inv-1', 'Confirmed', 'req-1');
      expect(mockInvRepo.create).toHaveBeenCalledWith({
        fraudAlertId: 'alert-1',
        investigatorId: 'inv-1',
        action: FraudInvestigationAction.CONFIRM_FRAUD,
        notes: 'Confirmed',
      });
    });

    it('creates audit log FRAUD_CONFIRMED with fraudScore and severity in payload', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.confirmFraud('alert-1', 'inv-1', 'note', 'req-xyz');
      expect(mockAuditRepo.create).toHaveBeenCalledTimes(1);
      expect(mockAuditRepo.create).toHaveBeenCalledWith({
        userId: 'inv-1',
        action: 'FRAUD_CONFIRMED',
        resourceType: 'FraudAlert',
        resourceId: 'alert-1',
        requestId: 'req-xyz',
        ipAddress: 'system',
        metadata: {
          fraudScore: 85,
          severity: FraudSeverity.CRITICAL,
          status: FraudAlertStatus.CONFIRMED_FRAUD,
        },
      });
    });

    it('throws AppError(NOT_FOUND) when alert not found', async () => {
      mockAlertRepo.findById.mockResolvedValue(null);
      await expect(
        service.confirmFraud('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('[BLOCKED] OPEN -> CONFIRMED_FRAUD throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      await expect(
        service.confirmFraud('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('[BLOCKED] FALSE_POSITIVE -> CONFIRMED_FRAUD throws AppError(BAD_REQUEST)', async () => {
      mockAlertRepo.findById.mockResolvedValue(
        getAlertMock(FraudAlertStatus.FALSE_POSITIVE) as any,
      );
      const err = await service.confirmFraud('alert-1', 'inv-1', 'note', 'req-1').catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('[BLOCKED] already CONFIRMED_FRAUD -> CONFIRMED_FRAUD throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(
        getAlertMock(FraudAlertStatus.CONFIRMED_FRAUD) as any,
      );
      await expect(
        service.confirmFraud('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('[BLOCKED] RESOLVED -> CONFIRMED_FRAUD throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.RESOLVED) as any);
      await expect(
        service.confirmFraud('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('propagates audit repository errors', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      mockAuditRepo.create.mockRejectedValue(new Error('Audit write failed'));
      await expect(service.confirmFraud('alert-1', 'inv-1', 'note', 'req-1')).rejects.toThrow(
        'Audit write failed',
      );
    });
  });

  // markFalsePositive: UNDER_REVIEW -> FALSE_POSITIVE
  describe('markFalsePositive (UNDER_REVIEW -> FALSE_POSITIVE)', () => {
    it('transitions alert from UNDER_REVIEW to FALSE_POSITIVE', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.markFalsePositive('alert-1', 'inv-1', 'FP reason', 'req-1');
      expect(mockAlertRepo.updateStatus).toHaveBeenCalledWith('alert-1', {
        status: FraudAlertStatus.FALSE_POSITIVE,
        reviewedBy: 'inv-1',
        resolutionReason: 'FP reason',
      });
    });

    it('creates investigation history with MARK_FALSE_POSITIVE action', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.markFalsePositive('alert-1', 'inv-1', 'FP', 'req-1');
      expect(mockInvRepo.create).toHaveBeenCalledWith({
        fraudAlertId: 'alert-1',
        investigatorId: 'inv-1',
        action: FraudInvestigationAction.MARK_FALSE_POSITIVE,
        notes: 'FP',
      });
    });

    it('creates audit log FRAUD_FALSE_POSITIVE with fraudScore and severity', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.markFalsePositive('alert-1', 'inv-1', 'FP', 'req-fp');
      expect(mockAuditRepo.create).toHaveBeenCalledTimes(1);
      expect(mockAuditRepo.create).toHaveBeenCalledWith({
        userId: 'inv-1',
        action: 'FRAUD_FALSE_POSITIVE',
        resourceType: 'FraudAlert',
        resourceId: 'alert-1',
        requestId: 'req-fp',
        ipAddress: 'system',
        metadata: {
          fraudScore: 85,
          severity: FraudSeverity.CRITICAL,
          status: FraudAlertStatus.FALSE_POSITIVE,
        },
      });
    });

    it('throws AppError(NOT_FOUND) when alert not found', async () => {
      mockAlertRepo.findById.mockResolvedValue(null);
      await expect(
        service.markFalsePositive('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('[BLOCKED] CONFIRMED_FRAUD -> FALSE_POSITIVE throws AppError(BAD_REQUEST)', async () => {
      mockAlertRepo.findById.mockResolvedValue(
        getAlertMock(FraudAlertStatus.CONFIRMED_FRAUD) as any,
      );
      const err = await service
        .markFalsePositive('alert-1', 'inv-1', 'note', 'req-1')
        .catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('[BLOCKED] OPEN -> FALSE_POSITIVE throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      await expect(
        service.markFalsePositive('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('[BLOCKED] already FALSE_POSITIVE -> FALSE_POSITIVE throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(
        getAlertMock(FraudAlertStatus.FALSE_POSITIVE) as any,
      );
      await expect(
        service.markFalsePositive('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('[BLOCKED] RESOLVED -> FALSE_POSITIVE throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.RESOLVED) as any);
      await expect(
        service.markFalsePositive('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('propagates audit repository errors', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      mockAuditRepo.create.mockRejectedValue(new Error('Audit error'));
      await expect(service.markFalsePositive('alert-1', 'inv-1', 'note', 'req-1')).rejects.toThrow(
        'Audit error',
      );
    });
  });

  // resolveAlert: UNDER_REVIEW -> RESOLVED
  describe('resolveAlert (UNDER_REVIEW -> RESOLVED)', () => {
    it('transitions alert from UNDER_REVIEW to RESOLVED', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.resolveAlert('alert-1', 'inv-1', 'Resolved reason', 'req-1');
      expect(mockAlertRepo.updateStatus).toHaveBeenCalledWith('alert-1', {
        status: FraudAlertStatus.RESOLVED,
        reviewedBy: 'inv-1',
        resolutionReason: 'Resolved reason',
      });
    });

    it('creates investigation history with RESOLVE action', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.resolveAlert('alert-1', 'inv-1', 'reason', 'req-1');
      expect(mockInvRepo.create).toHaveBeenCalledWith({
        fraudAlertId: 'alert-1',
        investigatorId: 'inv-1',
        action: FraudInvestigationAction.RESOLVE,
        notes: 'reason',
      });
    });

    it('creates audit log FRAUD_ALERT_RESOLVED with fraudScore and severity', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.resolveAlert('alert-1', 'inv-1', 'reason', 'req-resolve');
      expect(mockAuditRepo.create).toHaveBeenCalledTimes(1);
      expect(mockAuditRepo.create).toHaveBeenCalledWith({
        userId: 'inv-1',
        action: 'FRAUD_ALERT_RESOLVED',
        resourceType: 'FraudAlert',
        resourceId: 'alert-1',
        requestId: 'req-resolve',
        ipAddress: 'system',
        metadata: {
          fraudScore: 85,
          severity: FraudSeverity.CRITICAL,
          status: FraudAlertStatus.RESOLVED,
        },
      });
    });

    it('throws AppError(NOT_FOUND) when alert not found', async () => {
      mockAlertRepo.findById.mockResolvedValue(null);
      await expect(
        service.resolveAlert('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('[BLOCKED] RESOLVED -> RESOLVED throws AppError (already resolved)', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.RESOLVED) as any);
      const err = await service.resolveAlert('alert-1', 'inv-1', 'note', 'req-1').catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockAlertRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('[BLOCKED] OPEN -> RESOLVED throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      await expect(
        service.resolveAlert('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('[BLOCKED] CONFIRMED_FRAUD -> RESOLVED throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(
        getAlertMock(FraudAlertStatus.CONFIRMED_FRAUD) as any,
      );
      await expect(
        service.resolveAlert('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('[BLOCKED] FALSE_POSITIVE -> RESOLVED throws AppError', async () => {
      mockAlertRepo.findById.mockResolvedValue(
        getAlertMock(FraudAlertStatus.FALSE_POSITIVE) as any,
      );
      await expect(
        service.resolveAlert('alert-1', 'inv-1', 'note', 'req-1'),
      ).rejects.toBeInstanceOf(AppError);
    });

    it('propagates audit repository errors', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      mockAuditRepo.create.mockRejectedValue(new Error('Audit DB error'));
      await expect(service.resolveAlert('alert-1', 'inv-1', 'note', 'req-1')).rejects.toThrow(
        'Audit DB error',
      );
    });
  });

  // Audit creation count verification
  describe('Audit event - exactly once per operation', () => {
    it('creates audit exactly once per startReview', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.OPEN) as any);
      await service.startReview('alert-1', 'inv-1', 'req-1');
      expect(mockAuditRepo.create).toHaveBeenCalledTimes(1);
    });

    it('creates audit exactly once per confirmFraud', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.confirmFraud('alert-1', 'inv-1', 'note', 'req-1');
      expect(mockAuditRepo.create).toHaveBeenCalledTimes(1);
    });

    it('creates audit exactly once per markFalsePositive', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.markFalsePositive('alert-1', 'inv-1', 'note', 'req-1');
      expect(mockAuditRepo.create).toHaveBeenCalledTimes(1);
    });

    it('creates audit exactly once per resolveAlert', async () => {
      mockAlertRepo.findById.mockResolvedValue(getAlertMock(FraudAlertStatus.UNDER_REVIEW) as any);
      await service.resolveAlert('alert-1', 'inv-1', 'note', 'req-1');
      expect(mockAuditRepo.create).toHaveBeenCalledTimes(1);
    });
  });
});
