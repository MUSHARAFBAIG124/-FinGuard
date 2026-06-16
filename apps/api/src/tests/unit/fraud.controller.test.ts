import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudController } from '../../controllers/fraud.controller';
import { StatusCodes } from 'http-status-codes';
import { FraudSeverity } from '@finguard/shared';
import { AppError } from '../../errors/app-error';

describe('FraudController', () => {
  let controller: FraudController;
  let mockRuleEngine: any;
  let mockInvestigationService: any;
  let mockAnalyticsService: any;
  let mockAlertRepo: any;
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockRuleEngine = { calculateFraudScore: vi.fn() };
    mockInvestigationService = {
      startReview: vi.fn(),
      confirmFraud: vi.fn(),
      markFalsePositive: vi.fn(),
      resolveAlert: vi.fn(),
    };
    mockAnalyticsService = { getFraudAnalytics: vi.fn() };
    mockAlertRepo = {
      create: vi.fn(),
      listRecent: vi.fn(),
      findOpenAlerts: vi.fn(),
      findCriticalAlerts: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      updateStatus: vi.fn(),
    };

    controller = new FraudController(
      mockRuleEngine,
      mockInvestigationService,
      mockAnalyticsService,
      mockAlertRepo,
    );

    mockReq = {
      body: {},
      params: {},
      auth: { sub: 'user-1' },
      requestId: 'req-1',
    };
    mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      req: mockReq,
    };
    mockNext = vi.fn();
  });

  // POST /fraud/check
  describe('check (POST /fraud/check)', () => {
    it('should return fraud score result without creating alert when score <= 25', async () => {
      mockReq.body = { transactionId: 'tx-1', amount: 100, country: 'US', accountAgeDays: 100 };
      const scoreResult = { fraudScore: 10, severity: FraudSeverity.LOW, ruleTriggers: [] };
      mockRuleEngine.calculateFraudScore.mockReturnValue(scoreResult);

      await controller.check(mockReq, mockRes, mockNext);

      expect(mockAlertRepo.create).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: scoreResult }));
    });

    it('should return fraud score result without creating alert when score exactly 25', async () => {
      mockReq.body = { transactionId: 'tx-1', amount: 100, country: 'US', accountAgeDays: 100 };
      const scoreResult = {
        fraudScore: 25,
        severity: FraudSeverity.LOW,
        ruleTriggers: ['LARGE_TRANSACTION'],
      };
      mockRuleEngine.calculateFraudScore.mockReturnValue(scoreResult);

      await controller.check(mockReq, mockRes, mockNext);

      expect(mockAlertRepo.create).not.toHaveBeenCalled();
    });

    it('should create alert when fraud score > 25', async () => {
      mockReq.body = { transactionId: 'tx-1', amount: 1000000, country: 'US', accountAgeDays: 100 };
      const scoreResult = {
        fraudScore: 60,
        severity: FraudSeverity.HIGH,
        ruleTriggers: ['LARGE_TRANSACTION'],
      };
      mockRuleEngine.calculateFraudScore.mockReturnValue(scoreResult);

      await controller.check(mockReq, mockRes, mockNext);

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'tx-1',
          fraudScore: 60,
          severity: FraudSeverity.HIGH,
          ruleTriggers: ['LARGE_TRANSACTION'],
        }),
      );
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: scoreResult }));
    });

    it('should use authenticated user ID in fraud context', async () => {
      mockReq.auth = { sub: 'real-user-id' };
      mockReq.body = { transactionId: 'tx-1', amount: 100, country: 'US', accountAgeDays: 50 };
      const scoreResult = { fraudScore: 26, severity: FraudSeverity.MEDIUM, ruleTriggers: [] };
      mockRuleEngine.calculateFraudScore.mockReturnValue(scoreResult);

      await controller.check(mockReq, mockRes, mockNext);

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'real-user-id' }),
      );
    });

    it('should use "unknown" userId when auth is missing', async () => {
      mockReq.auth = undefined;
      mockReq.body = { transactionId: 'tx-1', amount: 100, country: 'US', accountAgeDays: 50 };
      const scoreResult = { fraudScore: 26, severity: FraudSeverity.MEDIUM, ruleTriggers: [] };
      mockRuleEngine.calculateFraudScore.mockReturnValue(scoreResult);

      await controller.check(mockReq, mockRes, mockNext);

      expect(mockAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'unknown' }),
      );
    });

    it('should call next with error when rule engine throws', async () => {
      mockRuleEngine.calculateFraudScore.mockImplementation(() => {
        throw new Error('Engine error');
      });
      await controller.check(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should call next when alertRepo.create throws', async () => {
      mockReq.body = { transactionId: 'tx-1', amount: 100, country: 'US', accountAgeDays: 50 };
      mockRuleEngine.calculateFraudScore.mockReturnValue({
        fraudScore: 50,
        severity: FraudSeverity.MEDIUM,
        ruleTriggers: [],
      });
      mockAlertRepo.create.mockRejectedValue(new Error('DB failure'));

      await controller.check(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // GET /fraud/alerts
  describe('getAlerts (GET /fraud/alerts)', () => {
    it('should return list of recent alerts', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      await controller.getAlerts(mockReq, mockRes, mockNext);
      expect(mockAlertRepo.listRecent).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ id: '1' }, { id: '2' }] }),
      );
    });

    it('should return empty array when no alerts', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([]);
      await controller.getAlerts(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
    });

    it('should call next with error on repository failure', async () => {
      mockAlertRepo.listRecent.mockRejectedValue(new Error('DB error'));
      await controller.getAlerts(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // GET /fraud/alerts/open
  describe('getOpenAlerts (GET /fraud/alerts/open)', () => {
    it('should return open alerts', async () => {
      mockAlertRepo.findOpenAlerts.mockResolvedValue([{ id: '2', status: 'OPEN' }]);
      await controller.getOpenAlerts(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ id: '2', status: 'OPEN' }] }),
      );
    });

    it('should call next with error on repository failure', async () => {
      mockAlertRepo.findOpenAlerts.mockRejectedValue(new Error('fail'));
      await controller.getOpenAlerts(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // GET /fraud/alerts/critical
  describe('getCriticalAlerts (GET /fraud/alerts/critical)', () => {
    it('should return critical alerts', async () => {
      mockAlertRepo.findCriticalAlerts.mockResolvedValue([{ id: '3', severity: 'CRITICAL' }]);
      await controller.getCriticalAlerts(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ id: '3', severity: 'CRITICAL' }] }),
      );
    });

    it('should call next with error on repository failure', async () => {
      mockAlertRepo.findCriticalAlerts.mockRejectedValue(new Error('fail'));
      await controller.getCriticalAlerts(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // GET /fraud/alerts/:id
  describe('getAlertById (GET /fraud/alerts/:id)', () => {
    it('should return alert when found', async () => {
      mockReq.params.id = 'alert-1';
      mockAlertRepo.findById.mockResolvedValue({ id: 'alert-1', fraudScore: 75 });
      await controller.getAlertById(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { id: 'alert-1', fraudScore: 75 } }),
      );
    });

    it('should return 404 when alert not found', async () => {
      mockReq.params.id = 'nonexistent';
      mockAlertRepo.findById.mockResolvedValue(null);
      await controller.getAlertById(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: 'Alert not found' }),
        }),
      );
    });

    it('should call next with error on repository failure', async () => {
      mockReq.params.id = 'alert-1';
      mockAlertRepo.findById.mockRejectedValue(new Error('DB error'));
      await controller.getAlertById(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // POST /fraud/alerts/:id/review
  describe('startReview (POST /fraud/alerts/:id/review)', () => {
    it('should start review and return success message', async () => {
      mockReq.params.id = 'alert-1';
      mockInvestigationService.startReview.mockResolvedValue(undefined);
      await controller.startReview(mockReq, mockRes, mockNext);
      expect(mockInvestigationService.startReview).toHaveBeenCalledWith(
        'alert-1',
        'user-1',
        'req-1',
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { message: 'Review started' } }),
      );
    });

    it('should propagate auth sub to investigationService', async () => {
      mockReq.params.id = 'alert-2';
      mockReq.auth = { sub: 'investigator-id' };
      await controller.startReview(mockReq, mockRes, mockNext);
      expect(mockInvestigationService.startReview).toHaveBeenCalledWith(
        'alert-2',
        'investigator-id',
        'req-1',
      );
    });

    it('should use "system" when auth is missing', async () => {
      mockReq.auth = undefined;
      mockReq.params.id = 'alert-1';
      await controller.startReview(mockReq, mockRes, mockNext);
      expect(mockInvestigationService.startReview).toHaveBeenCalledWith(
        'alert-1',
        'system',
        'req-1',
      );
    });

    it('should call next with AppError on invalid transition', async () => {
      mockReq.params.id = 'alert-1';
      mockInvestigationService.startReview.mockRejectedValue(
        new AppError({
          code: 'INVALID_STATE_TRANSITION',
          message: 'Cannot start review',
          statusCode: StatusCodes.BAD_REQUEST,
        }),
      );
      await controller.startReview(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    });

    it('should call next with error on service failure', async () => {
      mockReq.params.id = 'alert-1';
      mockInvestigationService.startReview.mockRejectedValue(new Error('Service failed'));
      await controller.startReview(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // POST /fraud/alerts/:id/confirm
  describe('confirmFraud (POST /fraud/alerts/:id/confirm)', () => {
    it('should confirm fraud and return success message', async () => {
      mockReq.params.id = 'alert-1';
      mockReq.body.notes = 'confirmed note';
      await controller.confirmFraud(mockReq, mockRes, mockNext);
      expect(mockInvestigationService.confirmFraud).toHaveBeenCalledWith(
        'alert-1',
        'user-1',
        'confirmed note',
        'req-1',
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { message: 'Fraud confirmed' } }),
      );
    });

    it('should call next with error on service failure', async () => {
      mockReq.params.id = 'alert-1';
      mockInvestigationService.confirmFraud.mockRejectedValue(new Error('fail'));
      await controller.confirmFraud(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // POST /fraud/alerts/:id/false-positive
  describe('markFalsePositive (POST /fraud/alerts/:id/false-positive)', () => {
    it('should mark as false positive and return success message', async () => {
      mockReq.params.id = 'alert-1';
      mockReq.body.notes = 'fp note';
      await controller.markFalsePositive(mockReq, mockRes, mockNext);
      expect(mockInvestigationService.markFalsePositive).toHaveBeenCalledWith(
        'alert-1',
        'user-1',
        'fp note',
        'req-1',
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { message: 'Marked as false positive' } }),
      );
    });

    it('should call next with error on service failure', async () => {
      mockReq.params.id = 'alert-1';
      mockInvestigationService.markFalsePositive.mockRejectedValue(new Error('fail'));
      await controller.markFalsePositive(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // POST /fraud/alerts/:id/resolve
  describe('resolveAlert (POST /fraud/alerts/:id/resolve)', () => {
    it('should resolve alert and return success message', async () => {
      mockReq.params.id = 'alert-1';
      mockReq.body.notes = 'resolve note';
      await controller.resolveAlert(mockReq, mockRes, mockNext);
      expect(mockInvestigationService.resolveAlert).toHaveBeenCalledWith(
        'alert-1',
        'user-1',
        'resolve note',
        'req-1',
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: { message: 'Alert resolved' } }),
      );
    });

    it('should call next with error on service failure', async () => {
      mockReq.params.id = 'alert-1';
      mockInvestigationService.resolveAlert.mockRejectedValue(new Error('fail'));
      await controller.resolveAlert(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // GET /fraud/analytics
  describe('getAnalytics (GET /fraud/analytics)', () => {
    it('should return fraud analytics', async () => {
      const analytics = { metrics: { totalAlerts: 10, openAlerts: 3 }, topTriggeredRules: [] };
      mockAnalyticsService.getFraudAnalytics.mockResolvedValue(analytics);
      await controller.getAnalytics(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: analytics }));
    });

    it('should call next with error on service failure', async () => {
      mockAnalyticsService.getFraudAnalytics.mockRejectedValue(new Error('Analytics error'));
      await controller.getAnalytics(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requestId propagation', () => {
    it('should propagate requestId from request to startReview', async () => {
      mockReq.params.id = 'alert-1';
      mockReq.requestId = 'unique-req-id-123';
      await controller.startReview(mockReq, mockRes, mockNext);
      expect(mockInvestigationService.startReview).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'unique-req-id-123',
      );
    });

    it('should propagate requestId from request to confirmFraud', async () => {
      mockReq.params.id = 'alert-1';
      mockReq.body.notes = 'some note';
      mockReq.requestId = 'req-confirm-456';
      await controller.confirmFraud(mockReq, mockRes, mockNext);
      expect(mockInvestigationService.confirmFraud).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        'req-confirm-456',
      );
    });
  });
});
