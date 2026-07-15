import type { Request, Response } from 'express';
import type { ModelGovernanceService } from '../services/model-governance.service';
import type { DriftDetectionService } from '../services/drift-detection.service';
import type { GovernanceAnalyticsService } from '../services/governance-analytics.service';
import type { FeatureDistribution } from '../services/drift-detection.service';

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class ModelGovernanceController {
  constructor(
    private readonly governanceService: ModelGovernanceService,
    private readonly driftService: DriftDetectionService,
    private readonly analyticsService: GovernanceAnalyticsService,
  ) {}

  public async registerModel(req: RequestWithUser, res: Response): Promise<void> {
    const {
      modelVersion,
      modelType,
      accuracy,
      precision,
      recall,
      f1Score,
      rocAuc,
      datasetName,
      datasetSize,
    } = req.body;
    const trainedBy = req.user?.id;

    if (!trainedBy) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!modelVersion || !modelType || accuracy === undefined || f1Score === undefined) {
      res
        .status(400)
        .json({ error: 'Missing required fields: modelVersion, modelType, accuracy, f1Score' });
      return;
    }

    const result = await this.governanceService.registerModel({
      modelVersion,
      modelType,
      trainedBy,
      accuracy,
      precision: precision ?? 0,
      recall: recall ?? 0,
      f1Score,
      rocAuc: rocAuc ?? 0,
      datasetName: datasetName ?? 'unknown',
      datasetSize: datasetSize ?? 0,
    });

    res.status(201).json({ success: true, data: result });
  }

  public async listModels(req: RequestWithUser, res: Response): Promise<void> {
    const models = await this.governanceService.listModels();
    res.status(200).json({ success: true, data: models });
  }

  public async getModelDetails(req: RequestWithUser, res: Response): Promise<void> {
    const version = req.params.version;
    if (!version) {
      res.status(400).json({ error: 'Model version is required' });
      return;
    }
    const model = await this.governanceService.getModelDetails(version);

    if (!model) {
      res.status(404).json({ error: `Model version ${version} not found` });
      return;
    }

    res.status(200).json({ success: true, data: model });
  }

  public async approveModel(req: RequestWithUser, res: Response): Promise<void> {
    const version = req.params.version;
    if (!version) {
      res.status(400).json({ error: 'Model version is required' });
      return;
    }
    const { reason } = req.body;
    const approvedBy = req.user?.id;

    if (!approvedBy) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: 'Reason is required' });
      return;
    }

    const result = await this.governanceService.approveModel(version, approvedBy, reason);
    res.status(200).json({ success: true, data: result });
  }

  public async rejectModel(req: RequestWithUser, res: Response): Promise<void> {
    const version = req.params.version;
    if (!version) {
      res.status(400).json({ error: 'Model version is required' });
      return;
    }
    const { reason } = req.body;
    const rejectedBy = req.user?.id;

    if (!rejectedBy) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: 'Reason is required' });
      return;
    }

    const result = await this.governanceService.rejectModel(version, rejectedBy, reason);
    res.status(200).json({ success: true, data: result });
  }

  public async retireModel(req: RequestWithUser, res: Response): Promise<void> {
    const version = req.params.version;
    if (!version) {
      res.status(400).json({ error: 'Model version is required' });
      return;
    }
    const { reason } = req.body;
    const retiredBy = req.user?.id;

    if (!retiredBy) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: 'Reason is required' });
      return;
    }

    const result = await this.governanceService.retireModel(version, retiredBy, reason);
    res.status(200).json({ success: true, data: result });
  }

  public async checkDrift(req: RequestWithUser, res: Response): Promise<void> {
    const { modelVersion, features } = req.body;

    if (!modelVersion || !features || !Array.isArray(features)) {
      res.status(400).json({ error: 'Missing required fields: modelVersion, features (array)' });
      return;
    }

    const typedFeatures: FeatureDistribution[] = features.map((f: Record<string, unknown>) => ({
      featureName: String(f.featureName),
      trainingMean: Number(f.trainingMean),
      trainingStd: Number(f.trainingStd ?? 0),
      trainingSize: Number(f.trainingSize ?? 0),
      productionMean: Number(f.productionMean),
      productionStd: Number(f.productionStd ?? 0),
      productionSize: Number(f.productionSize ?? 0),
      trainingHistogram: Array.isArray(f.trainingHistogram)
        ? (f.trainingHistogram as number[])
        : new Array(10).fill(0),
      productionHistogram: Array.isArray(f.productionHistogram)
        ? (f.productionHistogram as number[])
        : new Array(10).fill(0),
    }));

    const results = await this.driftService.analyzeDrift(modelVersion, typedFeatures);
    res.status(200).json({ success: true, data: results });
  }

  public async listDriftRecords(req: RequestWithUser, res: Response): Promise<void> {
    const { modelVersion } = req.query;
    const records = await this.driftService.getDriftRecords(
      modelVersion ? String(modelVersion) : undefined,
    );
    res.status(200).json({ success: true, data: records });
  }

  public async listCriticalDrift(req: RequestWithUser, res: Response): Promise<void> {
    const records = await this.driftService.getCriticalDriftRecords();
    res.status(200).json({ success: true, data: records });
  }

  public async getAnalytics(req: RequestWithUser, res: Response): Promise<void> {
    const analytics = await this.analyticsService.getGovernanceSummary();
    res.status(200).json({ success: true, data: analytics });
  }
}
