import {
  model,
  models,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { USER_MODEL_NAME } from './user.model';
import { applyImmutableQueryGuard } from './schema-helpers';

export const AUDIT_LOG_MODEL_NAME = 'AuditLog';

export const AuditLogSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: true,
      immutable: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'userId must be a valid ObjectId',
      },
    },
    action: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 3,
      maxlength: 160,
    },
    resourceType: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    resourceId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
    },
    ipAddress: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 64,
    },
    requestId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 8,
      maxlength: 128,
    },
    metadata: {
      type: Schema.Types.Mixed,
      immutable: true,
      default: {},
    },
  },
  {
    collection: 'audit_logs',
    strict: 'throw',
    timestamps: {
      createdAt: 'timestamp',
      updatedAt: false,
    },
    versionKey: false,
  },
);

AuditLogSchema.index({ timestamp: -1 }, { name: 'ix_audit_logs_timestamp' });
AuditLogSchema.index({ userId: 1, timestamp: -1 }, { name: 'ix_audit_logs_user_timestamp' });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 }, { name: 'ix_audit_logs_resource' });
applyImmutableQueryGuard(AuditLogSchema, 'AuditLog');

export type AuditLog = InferSchemaType<typeof AuditLogSchema>;
export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogModel: Model<AuditLog> =
  (models[AUDIT_LOG_MODEL_NAME] as Model<AuditLog> | undefined) ??
  model<AuditLog>(AUDIT_LOG_MODEL_NAME, AuditLogSchema);
