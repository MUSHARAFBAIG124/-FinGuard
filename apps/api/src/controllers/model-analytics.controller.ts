import type { Request, Response } from 'express';
import { GovernanceAnalyticsService } from '../services/governance-analytics.service';

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class ModelAnalyticsController {
  constructor(private readonly analyticsService: GovernanceAnalyticsService) {}

  private async logView(req: RequestWithUser, endpoint: string): Promise<void> {
    const userId = req.user?.id || 'system';
    const requestId = (req.headers['x-request-id'] as string) || `analytics-${Date.now()}`;
    await this.analyticsService.logAnalyticsView(userId, endpoint, requestId);
  }

  public async getSummary(req: RequestWithUser, res: Response): Promise<void> {
    await this.logView(req, '/analytics/summary');
    const summary = await this.analyticsService.getGovernanceSummary();
    res.status(200).json({ success: true, data: summary });
  }

  public async getModelStats(req: RequestWithUser, res: Response): Promise<void> {
    await this.logView(req, '/analytics/models');
    const stats = await this.analyticsService.getModelStatistics();
    res.status(200).json({ success: true, data: stats });
  }

  public async getDriftStats(req: RequestWithUser, res: Response): Promise<void> {
    await this.logView(req, '/analytics/drift');
    const stats = await this.analyticsService.getDriftStatistics();
    res.status(200).json({ success: true, data: stats });
  }

  public async getHealthScore(req: RequestWithUser, res: Response): Promise<void> {
    await this.logView(req, '/analytics/health');
    const health = await this.analyticsService.calculateGovernanceHealthScore();
    res.status(200).json({ success: true, data: health });
  }
}
