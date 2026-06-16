import {
  model,
  models,
  Schema,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { UserRole, UserStatus } from '@finguard/shared';

import { enumValues } from './schema-helpers';

export const USER_MODEL_NAME = 'User';

export const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email must be valid'],
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 32,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    role: {
      type: String,
      required: true,
      enum: enumValues(UserRole),
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(UserStatus),
      default: UserStatus.ACTIVE,
    },
    isEmailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    failedLoginAttempts: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      select: false,
    },
    lockedUntil: {
      type: Date,
      default: null,
      select: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    collection: 'users',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

UserSchema.index({ email: 1 }, { unique: true, name: 'ux_users_email' });
UserSchema.index({ role: 1, status: 1 }, { name: 'ix_users_role_status' });
UserSchema.index({ lockedUntil: 1 }, { name: 'ix_users_locked_until', sparse: true });

export type User = InferSchemaType<typeof UserSchema>;
export type UserDocument = HydratedDocument<User>;
export const UserModel: Model<User> =
  (models[USER_MODEL_NAME] as Model<User> | undefined) ?? model<User>(USER_MODEL_NAME, UserSchema);
