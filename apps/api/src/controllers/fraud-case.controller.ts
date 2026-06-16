import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { FraudCaseManagementService } from '../services/fraud-case-management.service';
import { FraudCaseAssignmentService } from '../services/fraud-case-assignment.service';
import { FraudEscalationService } from '../services/fraud-escalation.service';
import { FraudOperationsAnalyticsService } from '../services/fraud-operations-analytics.service';
import { FraudSLAService } from '../services/fraud-sla.service';
import { sendSuccess } from '../utils/api-response';
import { FraudOwnerRole } from '@finguard/shared';

export class FraudCaseController {
  constructor(
    private readonly managementService: FraudCaseManagementService,
    private readonly assignmentService: FraudCaseAssignmentService,
    private readonly escalationService: FraudEscalationService,
    private readonly analyticsService: FraudOperationsAnalyticsService,
    private readonly slaService: FraudSLAService,
  ) {}

  async createCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fraudAlertId, priority } = req.body;
      const fraudCase = await this.managementService.createCase(
        fraudAlertId,
        req.auth?.sub || 'system',
        priority,
        req.requestId as string,
      );
      sendSuccess(res, { data: fraudCase, statusCode: StatusCodes.CREATED });
    } catch (error) {
      next(error);
    }
  }

  async listCases(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cases = await this.managementService.listCases(req.query);
      sendSuccess(res, { data: cases });
    } catch (error) {
      next(error);
    }
  }

  async getCaseDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fraudCase = await this.managementService.getCase(req.params.id as string);
      sendSuccess(res, { data: fraudCase });
    } catch (error) {
      next(error);
    }
  }

  async assignCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignedTo, role } = req.body;
      await this.assignmentService.assignCase(
        req.params.id as string,
        assignedTo,
        req.auth?.sub || 'system',
        role as FraudOwnerRole,
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Case assigned successfully' } });
    } catch (error) {
      next(error);
    }
  }

  async reassignCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignedTo, role } = req.body;
      await this.assignmentService.reassignCase(
        req.params.id as string,
        assignedTo,
        req.auth?.sub || 'system',
        role as FraudOwnerRole,
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Case reassigned successfully' } });
    } catch (error) {
      next(error);
    }
  }

  async escalateCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notes } = req.body;
      await this.escalationService.escalateCase(
        req.params.id as string,
        req.auth?.sub || 'system',
        notes,
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Case escalated successfully' } });
    } catch (error) {
      next(error);
    }
  }

  async resolveCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resolutionReason } = req.body;
      await this.managementService.resolveCase(
        req.params.id as string,
        req.auth?.sub || 'system',
        resolutionReason,
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Case resolved successfully' } });
    } catch (error) {
      next(error);
    }
  }

  async closeCase(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notes } = req.body;
      await this.managementService.closeCase(
        req.params.id as string,
        req.auth?.sub || 'system',
        notes,
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Case closed successfully' } });
    } catch (error) {
      next(error);
    }
  }

  async getDashboardMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await this.analyticsService.getDashboardMetrics();
      sendSuccess(res, { data: metrics });
    } catch (error) {
      next(error);
    }
  }

  async getInvestigatorMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await this.analyticsService.getInvestigatorMetrics();
      sendSuccess(res, { data: metrics });
    } catch (error) {
      next(error);
    }
  }

  async getSlaMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const breached = await this.slaService.getBreachedCases();
      const upcoming = await this.slaService.getUpcomingBreaches(2); // next 2 hours
      sendSuccess(res, { data: { breached, upcoming } });
    } catch (error) {
      next(error);
    }
  }
}
