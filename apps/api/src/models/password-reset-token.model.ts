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

export const PASSWORD_RESET_TOKEN_MODEL_NAME = 'PasswordResetToken';

export const PasswordResetTokenSchema = new Schema(
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
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'password_reset_tokens',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

PasswordResetTokenSchema.index(
  { tokenHash: 1 },
  { unique: true, name: 'ux_password_reset_tokens_hash' },
);
PasswordResetTokenSchema.index(
  { userId: 1, usedAt: 1 },
  { name: 'ix_password_reset_tokens_user_used' },
);
PasswordResetTokenSchema.index({ expiresAt: 1 }, { name: 'ix_password_reset_tokens_expires_at' });

export type PasswordResetToken = InferSchemaType<typeof PasswordResetTokenSchema>;
export type PasswordResetTokenDocument = HydratedDocument<PasswordResetToken>;
export const PasswordResetTokenModel: Model<PasswordResetToken> =
  (models[PASSWORD_RESET_TOKEN_MODEL_NAME] as Model<PasswordResetToken> | undefined) ??
  model<PasswordResetToken>(PASSWORD_RESET_TOKEN_MODEL_NAME, PasswordResetTokenSchema);
