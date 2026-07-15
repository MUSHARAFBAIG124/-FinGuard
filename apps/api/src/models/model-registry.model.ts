import mongoose, {
  model,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { ModelStatus } from '@finguard/shared';

import { enumValues } from './schema-helpers';
import { USER_MODEL_NAME } from './user.model';

export const MODEL_REGISTRY_MODEL_NAME = 'ModelRegistry';

export const ModelRegistrySchema = new mongoose.Schema(
  {
    modelVersion: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    modelType: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    trainedBy: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'trainedBy must be a valid ObjectId',
      },
    },
    accuracy: { type: Number, required: true, min: 0, max: 1 },
    precision: { type: Number, required: true, min: 0, max: 1 },
    recall: { type: Number, required: true, min: 0, max: 1 },
    f1Score: { type: Number, required: true, min: 0, max: 1 },
    rocAuc: { type: Number, required: true, min: 0, max: 1 },
    datasetName: { type: String, required: true, trim: true },
    datasetSize: { type: Number, required: true, min: 1 },
    approved: { type: Boolean, required: true, default: false },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: false,
      default: null,
    },
    approvedAt: { type: Date, required: false, default: null },
    approvalReason: { type: String, required: false, default: null, trim: true },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: false,
      default: null,
    },
    rejectedAt: { type: Date, required: false, default: null },
    rejectionReason: { type: String, required: false, default: null, trim: true },
    retiredBy: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: false,
      default: null,
    },
    retiredAt: { type: Date, required: false, default: null },
    retirementReason: { type: String, required: false, default: null, trim: true },
    status: {
      type: String,
      required: true,
      enum: enumValues(ModelStatus),
      default: ModelStatus.TRAINING,
    },
  },
  {
    collection: 'model_registry',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

ModelRegistrySchema.index({ modelVersion: 1 }, { name: 'ix_model_registry_version', unique: true });
ModelRegistrySchema.index({ status: 1, createdAt: -1 }, { name: 'ix_model_registry_status_date' });

export type ModelRegistry = InferSchemaType<typeof ModelRegistrySchema>;
export type ModelRegistryDocument = HydratedDocument<ModelRegistry>;
export const ModelRegistryModel: Model<ModelRegistry> =
  (mongoose.models[MODEL_REGISTRY_MODEL_NAME] as Model<ModelRegistry> | undefined) ??
  mongoose.model<ModelRegistry>(MODEL_REGISTRY_MODEL_NAME, ModelRegistrySchema);
