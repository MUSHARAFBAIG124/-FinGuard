import mongoose, {
  model,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { USER_MODEL_NAME } from './user.model';

export const EMAIL_VERIFICATION_TOKEN_MODEL_NAME = 'EmailVerificationToken';

export const EmailVerificationTokenSchema = new mongoose.Schema(
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
    collection: 'email_verification_tokens',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

EmailVerificationTokenSchema.index(
  { tokenHash: 1 },
  { unique: true, name: 'ux_email_verification_tokens_hash' },
);
EmailVerificationTokenSchema.index(
  { userId: 1, usedAt: 1 },
  { name: 'ix_email_verification_tokens_user_used' },
);
EmailVerificationTokenSchema.index(
  { expiresAt: 1 },
  { name: 'ix_email_verification_tokens_expires_at' },
);

export type EmailVerificationToken = InferSchemaType<typeof EmailVerificationTokenSchema>;
export type EmailVerificationTokenDocument = HydratedDocument<EmailVerificationToken>;
export const EmailVerificationTokenModel: Model<EmailVerificationToken> =
  (mongoose.models[EMAIL_VERIFICATION_TOKEN_MODEL_NAME] as
    | Model<EmailVerificationToken>
    | undefined) ??
  mongoose.model<EmailVerificationToken>(
    EMAIL_VERIFICATION_TOKEN_MODEL_NAME,
    EmailVerificationTokenSchema,
  );
