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

export const REFRESH_TOKEN_MODEL_NAME = 'RefreshToken';

export const RefreshTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'userId must be a valid ObjectId',
      },
    },
    tokenHash: {
      type: String,
      required: true,
      minlength: 64,
      maxlength: 64,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    deviceInfo: {
      userAgent: {
        type: String,
        required: true,
        trim: true,
        maxlength: 512,
      },
      ipAddress: {
        type: String,
        required: true,
        trim: true,
        maxlength: 64,
      },
    },
  },
  {
    collection: 'refresh_tokens',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

RefreshTokenSchema.index({ tokenHash: 1 }, { unique: true, name: 'ux_refresh_tokens_hash' });
RefreshTokenSchema.index({ userId: 1, revokedAt: 1 }, { name: 'ix_refresh_tokens_user_revoked' });
RefreshTokenSchema.index({ expiresAt: 1 }, { name: 'ix_refresh_tokens_expires_at' });

export type RefreshToken = InferSchemaType<typeof RefreshTokenSchema>;
export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenModel: Model<RefreshToken> =
  (models[REFRESH_TOKEN_MODEL_NAME] as Model<RefreshToken> | undefined) ??
  model<RefreshToken>(REFRESH_TOKEN_MODEL_NAME, RefreshTokenSchema);
