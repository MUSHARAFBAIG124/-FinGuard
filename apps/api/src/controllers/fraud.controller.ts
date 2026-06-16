import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { FraudRuleEngineService, FraudCheckContext } from '../services/fraud-rule-engine.service';
import { FraudInvestigationService } from '../services/fraud-investigation.service';
import { FraudAnalyticsService } from '../services/fraud-analytics.service';
import { FraudAlertRepository } from '../repositories/fraud-alert.repository';
import { sendSuccess, sendError } from '../utils/api-response';

export class FraudController {
  constructor(
    private readonly ruleEngine: FraudRuleEngineService,
    private readonly investigationService: FraudInvestigationService,
    private readonly analyticsService: FraudAnalyticsService,
    private readonly alertRepo: FraudAlertRepository,
  ) {}

  async check(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { transactionId, amount, country, accountAgeDays } = req.body;

      // Mocking the enrichment of context. In production, this would call other services.
      const context: FraudCheckContext = {
        transactionId,
        userId: req.auth?.sub || 'unknown',
        amount,
        country,
        accountAgeDays,
        transactionCountLast10Mins: 2, // Mocked
        withdrawalCountLastHour: 1, // Mocked
        isNewDevice: false, // Mocked
        isGeographicallyImpossible: false, // Mocked
        transactionHour: new Date().getHours(),
      };

      const result = this.ruleEngine.calculateFraudScore(context);

      // Create alert if score > 25
      if (result.fraudScore > 25) {
        await this.alertRepo.create({
          transactionId,
          userId: context.userId,
          fraudScore: result.fraudScore,
          severity: result.severity,
          ruleTriggers: result.ruleTriggers,
        });
      }

      sendSuccess(res, { data: result });
    } catch (error) {
      next(error);
    }
  }

  async getAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alerts = await this.alertRepo.listRecent();
      sendSuccess(res, { data: alerts });
    } catch (error) {
      next(error);
    }
  }

  async getOpenAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alerts = await this.alertRepo.findOpenAlerts();
      sendSuccess(res, { data: alerts });
    } catch (error) {
      next(error);
    }
  }

  async getCriticalAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alerts = await this.alertRepo.findCriticalAlerts();
      sendSuccess(res, { data: alerts });
    } catch (error) {
      next(error);
    }
  }

  async getAlertById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alert = await this.alertRepo.findById(req.params.id as string);
      if (!alert) {
        sendError(res, {
          code: 'NOT_FOUND',
          message: 'Alert not found',
          statusCode: StatusCodes.NOT_FOUND,
        });
        return;
      }
      sendSuccess(res, { data: alert });
    } catch (error) {
      next(error);
    }
  }

  async startReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.investigationService.startReview(
        req.params.id as string,
        req.auth?.sub || 'system',
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Review started' } });
    } catch (error) {
      next(error);
    }
  }

  async confirmFraud(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notes } = req.body;
      await this.investigationService.confirmFraud(
        req.params.id as string,
        req.auth?.sub || 'system',
        notes,
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Fraud confirmed' } });
    } catch (error) {
      next(error);
    }
  }

  async markFalsePositive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notes } = req.body;
      await this.investigationService.markFalsePositive(
        req.params.id as string,
        req.auth?.sub || 'system',
        notes,
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Marked as false positive' } });
    } catch (error) {
      next(error);
    }
  }

  async resolveAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { notes } = req.body;
      await this.investigationService.resolveAlert(
        req.params.id as string,
        req.auth?.sub || 'system',
        notes,
        req.requestId as string,
      );
      sendSuccess(res, { data: { message: 'Alert resolved' } });
    } catch (error) {
      next(error);
    }
  }

  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await this.analyticsService.getFraudAnalytics();
      sendSuccess(res, { data: analytics });
    } catch (error) {
      next(error);
    }
  }
}
