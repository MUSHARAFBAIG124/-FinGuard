import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { DriftLevel } from '@finguard/shared';

import { enumValues } from './schema-helpers';
import { MODEL_REGISTRY_MODEL_NAME } from './model-registry.model';

export const MODEL_DRIFT_RECORD_MODEL_NAME = 'ModelDriftRecord';

export const ModelDriftRecordSchema = new mongoose.Schema(
  {
    modelVersion: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    featureName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    trainingMean: { type: Number, required: true },
    productionMean: { type: Number, required: true },
    driftScore: { type: Number, required: true, min: 0 },
    driftLevel: {
      type: String,
      required: true,
      enum: enumValues(DriftLevel),
    },
  },
  {
    collection: 'model_drift_records',
    strict: 'throw',
    timestamps: {
      createdAt: 'detectedAt',
      updatedAt: false,
    },
    versionKey: false,
  },
);

ModelDriftRecordSchema.index({ modelVersion: 1, detectedAt: -1 }, { name: 'ix_drift_model_date' });
ModelDriftRecordSchema.index({ driftLevel: 1, detectedAt: -1 }, { name: 'ix_drift_level_date' });
ModelDriftRecordSchema.index({ detectedAt: -1 }, { name: 'ix_drift_detected_at' });

export type ModelDriftRecord = InferSchemaType<typeof ModelDriftRecordSchema>;
export type ModelDriftRecordDocument = HydratedDocument<ModelDriftRecord>;
export const ModelDriftRecordModel: Model<ModelDriftRecord> =
  (mongoose.models[MODEL_DRIFT_RECORD_MODEL_NAME] as Model<ModelDriftRecord> | undefined) ??
  mongoose.model<ModelDriftRecord>(MODEL_DRIFT_RECORD_MODEL_NAME, ModelDriftRecordSchema);
