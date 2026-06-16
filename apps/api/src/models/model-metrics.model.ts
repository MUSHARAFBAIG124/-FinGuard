import { model, models, Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

export const MODEL_METRICS_MODEL_NAME = 'ModelMetrics';

export const ModelMetricsSchema = new Schema(
  {
    modelVersion: { type: String, required: true, trim: true },
    predictionCount: { type: Number, required: true, default: 0 },
    successfulPredictions: { type: Number, required: true, default: 0 },
    failedPredictions: { type: Number, required: true, default: 0 },
    averageLatencyMs: { type: Number, required: true, default: 0 },
    lastPredictionAt: { type: Date, required: false },
  },
  {
    collection: 'model_metrics',
    timestamps: true,
    versionKey: false,
  },
);

ModelMetricsSchema.index({ modelVersion: 1 }, { name: 'ux_model_metrics_version' });

export type ModelMetrics = InferSchemaType<typeof ModelMetricsSchema>;
export type ModelMetricsDocument = HydratedDocument<ModelMetrics>;
export const ModelMetricsModel: Model<ModelMetrics> =
  (models[MODEL_METRICS_MODEL_NAME] as Model<ModelMetrics> | undefined) ??
  model<ModelMetrics>(MODEL_METRICS_MODEL_NAME, ModelMetricsSchema);
