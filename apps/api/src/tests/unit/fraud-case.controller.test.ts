import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudCaseController } from '../../controllers/fraud-case.controller';
import { Request, Response } from 'express';
import { FraudCasePriority, FraudOwnerRole } from '@finguard/shared';
import { StatusCodes } from 'http-status-codes';

describe('FraudCaseController', () => {
  let controller: FraudCaseController;
  let mockManagementService: any;
  let mockAssignmentService: any;
  let mockEscalationService: any;
  let mockAnalyticsService: any;
  let mockSlaService: any;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: any;

  beforeEach(() => {
    mockManagementService = {
      createCase: vi.fn(),
      listCases: vi.fn(),
      getCase: vi.fn(),
      resolveCase: vi.fn(),
      closeCase: vi.fn(),
    };
    mockAssignmentService = {
      assignCase: vi.fn(),
      reassignCase: vi.fn(),
    };
    mockEscalationService = {
      escalateCase: vi.fn(),
    };
    mockAnalyticsService = {
      getDashboardMetrics: vi.fn(),
      getInvestigatorMetrics: vi.fn(),
    };
    mockSlaService = {
      getBreachedCases: vi.fn(),
      getUpcomingBreaches: vi.fn(),
    };

    controller = new FraudCaseController(
      mockManagementService,
      mockAssignmentService,
      mockEscalationService,
      mockAnalyticsService,
      mockSlaService,
    );

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      req: { requestId: 'req-1' } as any,
    };
    next = vi.fn();
  });

  it('createCase should call management service and return 201', async () => {
    req = {
      body: { fraudAlertId: 'A-1', priority: FraudCasePriority.CRITICAL },
      auth: { sub: 'user-1' } as any,
      requestId: 'req-1',
    };
    mockManagementService.createCase.mockResolvedValue({ id: 'case-1' });

    await controller.createCase(req as Request, res as Response, next);

    expect(mockManagementService.createCase).toHaveBeenCalledWith(
      'A-1',
      'user-1',
      FraudCasePriority.CRITICAL,
      'req-1',
    );
    expect(res.status).toHaveBeenCalledWith(StatusCodes.CREATED);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 'case-1' } }));
  });

  it('assignCase should call assignment service', async () => {
    req = {
      params: { id: 'C-1' },
      body: { assignedTo: 'inv-2', role: FraudOwnerRole.SENIOR_INVESTIGATOR },
      auth: { sub: 'admin-1' } as any,
      requestId: 'req-1',
    };

    await controller.assignCase(req as Request, res as Response, next);

    expect(mockAssignmentService.assignCase).toHaveBeenCalledWith(
      'C-1',
      'inv-2',
      'admin-1',
      FraudOwnerRole.SENIOR_INVESTIGATOR,
      'req-1',
    );
    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
  });

  it('getDashboardMetrics should return dashboard data', async () => {
    req = {};
    mockAnalyticsService.getDashboardMetrics.mockResolvedValue({ totalCases: 100 });

    await controller.getDashboardMetrics(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { totalCases: 100 } }));
  });

  it('reassignCase should call assignment service', async () => {
    req = {
      params: { id: 'C-1' },
      body: { assignedTo: 'inv-2', role: FraudOwnerRole.INVESTIGATOR },
      auth: { sub: 'admin-1' } as any,
      requestId: 'req-1',
    };
    await controller.reassignCase(req as Request, res as Response, next);
    expect(mockAssignmentService.reassignCase).toHaveBeenCalledWith(
      'C-1',
      'inv-2',
      'admin-1',
      FraudOwnerRole.INVESTIGATOR,
      'req-1',
    );
  });

  it('escalateCase should call escalation service', async () => {
    req = {
      params: { id: 'C-1' },
      body: { notes: 'urgent' },
      auth: { sub: 'admin-1' } as any,
      requestId: 'req-1',
    };
    await controller.escalateCase(req as Request, res as Response, next);
    expect(mockEscalationService.escalateCase).toHaveBeenCalledWith(
      'C-1',
      'admin-1',
      'urgent',
      'req-1',
    );
  });

  it('resolveCase should call management service', async () => {
    req = {
      params: { id: 'C-1' },
      body: { resolutionReason: 'ok' },
      auth: { sub: 'admin-1' } as any,
      requestId: 'req-1',
    };
    await controller.resolveCase(req as Request, res as Response, next);
    expect(mockManagementService.resolveCase).toHaveBeenCalledWith('C-1', 'admin-1', 'ok', 'req-1');
  });

  it('closeCase should call management service', async () => {
    req = {
      params: { id: 'C-1' },
      body: { notes: 'done' },
      auth: { sub: 'admin-1' } as any,
      requestId: 'req-1',
    };
    await controller.closeCase(req as Request, res as Response, next);
    expect(mockManagementService.closeCase).toHaveBeenCalledWith('C-1', 'admin-1', 'done', 'req-1');
  });

  it('listCases should return cases list', async () => {
    req = { query: { status: 'OPEN' } };
    mockManagementService.listCases.mockResolvedValue([]);
    await controller.listCases(req as Request, res as Response, next);
    expect(mockManagementService.listCases).toHaveBeenCalledWith({ status: 'OPEN' });
  });

  it('getCaseDetails should return case details', async () => {
    req = { params: { id: 'C-1' } };
    mockManagementService.getCase.mockResolvedValue({ id: 'C-1' });
    await controller.getCaseDetails(req as Request, res as Response, next);
    expect(mockManagementService.getCase).toHaveBeenCalledWith('C-1');
  });

  it('getInvestigatorMetrics should return investigator metrics', async () => {
    req = {};
    mockAnalyticsService.getInvestigatorMetrics.mockResolvedValue([]);
    await controller.getInvestigatorMetrics(req as Request, res as Response, next);
    expect(res.json).toHaveBeenCalled();
  });

  it('getSlaMetrics should return SLA metrics', async () => {
    req = {};
    mockSlaService.getBreachedCases.mockResolvedValue([]);
    mockSlaService.getUpcomingBreaches.mockResolvedValue([]);
    await controller.getSlaMetrics(req as Request, res as Response, next);
    expect(res.json).toHaveBeenCalled();
  });
});
