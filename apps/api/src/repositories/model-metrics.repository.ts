import { ModelMetricsModel, type ModelMetricsDocument } from '../models/model-metrics.model';

export interface ModelMetricsRepository {
  incrementPrediction(
    modelVersion: string,
    latencyMs: number,
    success: boolean,
  ): Promise<ModelMetricsDocument>;
  getLatest(modelVersion: string): Promise<ModelMetricsDocument | null>;
  listAll(): Promise<readonly ModelMetricsDocument[]>;
}

export class MongooseModelMetricsRepository implements ModelMetricsRepository {
  public async incrementPrediction(modelVersion: string, latencyMs: number, success: boolean) {
    const now = new Date();

    // atomic upsert
    const doc = await ModelMetricsModel.findOneAndUpdate(
      { modelVersion },
      {
        $inc: {
          predictionCount: 1,
          successfulPredictions: success ? 1 : 0,
          failedPredictions: success ? 0 : 1,
        },
        $set: { lastPredictionAt: now },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    if (!doc) {
      throw new Error('Failed to update model metrics');
    }

    // Update average latency in a simple incremental way
    const count = doc.predictionCount;
    const prevAvg = doc.averageLatencyMs ?? 0;
    const newAvg = (prevAvg * (count - 1) + latencyMs) / Math.max(1, count);
    doc.averageLatencyMs = newAvg;
    await doc.save();
    return doc;
  }

  public async getLatest(modelVersion: string) {
    return ModelMetricsModel.findOne({ modelVersion }).exec();
  }

  public async listAll() {
    return ModelMetricsModel.find().sort({ modelVersion: 1 }).exec();
  }
}
