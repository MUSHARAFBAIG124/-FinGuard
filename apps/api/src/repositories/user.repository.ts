import type { UserRole, UserStatus } from '@finguard/shared';

import type { UserDocument } from '../models/user.model';
import { UserModel } from '../models/user.model';

export interface CreateUserInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly status?: UserStatus;
  readonly isEmailVerified?: boolean;
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<UserDocument>;
  findById(id: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
  findByEmailWithPassword(email: string): Promise<UserDocument | null>;
  existsByEmail(email: string): Promise<boolean>;
  markEmailVerified(id: string): Promise<UserDocument | null>;
  updatePassword(id: string, passwordHash: string): Promise<UserDocument | null>;
  recordFailedLogin(
    id: string,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void>;
  recordSuccessfulLogin(id: string, loggedInAt: Date): Promise<void>;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export class MongooseUserRepository implements UserRepository {
  public async create(input: CreateUserInput): Promise<UserDocument> {
    return UserModel.create({
      ...input,
      email: normalizeEmail(input.email),
    });
  }

  public async findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  }

  public async findByEmail(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: normalizeEmail(email) }).exec();
  }

  public async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email: normalizeEmail(email) })
      .select('+passwordHash +failedLoginAttempts +lockedUntil +lastLoginAt')
      .exec();
  }

  public async existsByEmail(email: string): Promise<boolean> {
    const result = await UserModel.exists({ email: normalizeEmail(email) }).exec();
    return result !== null;
  }

  public async markEmailVerified(id: string): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(id, { isEmailVerified: true }, { new: true }).exec();
  }

  public async updatePassword(id: string, passwordHash: string): Promise<UserDocument | null> {
    return UserModel.findByIdAndUpdate(
      id,
      {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      { new: true },
    ).exec();
  }

  public async recordFailedLogin(
    id: string,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      failedLoginAttempts,
      lockedUntil,
    }).exec();
  }

  public async recordSuccessfulLogin(id: string, loggedInAt: Date): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: loggedInAt,
    }).exec();
  }
}
