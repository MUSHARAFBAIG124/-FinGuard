import { readFileSync } from 'fs';
import { join } from 'path';
import type { Request, Response } from 'express';

import type { ModelMetricsService } from '../services/model-metrics.service';

export const createModelController = (deps: { modelMetricsService: ModelMetricsService }) => {
  const { modelMetricsService } = deps;

  const getMetrics = async (req: Request, res: Response) => {
    const version = String(req.query.modelVersion ?? '1.0.0');
    const metrics = await modelMetricsService.getModelMetrics(version);
    if (!metrics) {
      return res.status(404).json({ message: 'metrics not found' });
    }
    return res.json({
      modelVersion: metrics.modelVersion,
      predictionCount: metrics.predictionCount,
      successfulPredictions: metrics.successfulPredictions,
      failedPredictions: metrics.failedPredictions,
      averageLatencyMs: metrics.averageLatencyMs,
      lastPredictionAt: metrics.lastPredictionAt,
    });
  };

  const getInfo = async (_req: Request, res: Response) => {
    // Read metadata.json from services/ai/models
    const metaPath = join(process.cwd(), 'services', 'ai', 'models', 'metadata.json');
    let metadata: any = {};
    try {
      const raw = readFileSync(metaPath, 'utf8');
      metadata = JSON.parse(raw);
    } catch {
      // metadata missing
      metadata = { error: 'metadata not available' };
    }

    // attach metrics for this model version if available
    const metrics = await modelMetricsService.getModelMetrics(metadata.modelVersion ?? '1.0.0');

    return res.json({
      algorithm: metadata.algorithm ?? 'unknown',
      modelVersion: metadata.modelVersion ?? 'unknown',
      accuracy: metadata.accuracy ?? null,
      precision: metadata.precision ?? null,
      recall: metadata.recall ?? null,
      f1: metadata.f1 ?? null,
      rocAuc: metadata.rocAuc ?? null,
      topFeatures: metadata.topFeatures ?? [],
      metrics: metrics
        ? {
            modelVersion: metrics.modelVersion,
            predictionCount: metrics.predictionCount,
            successfulPredictions: metrics.successfulPredictions,
            failedPredictions: metrics.failedPredictions,
            averageLatencyMs: metrics.averageLatencyMs,
            lastPredictionAt: metrics.lastPredictionAt,
          }
        : null,
    });
  };

  return { getMetrics, getInfo };
};
