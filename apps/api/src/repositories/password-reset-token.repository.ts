import {
  PasswordResetTokenModel,
  type PasswordResetTokenDocument,
} from '../models/password-reset-token.model';

export interface CreatePasswordResetTokenInput {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface PasswordResetTokenRepository {
  create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenDocument>;
  findActiveByHash(tokenHash: string, now: Date): Promise<PasswordResetTokenDocument | null>;
  markUsed(id: string, usedAt: Date): Promise<void>;
}

export class MongoosePasswordResetTokenRepository implements PasswordResetTokenRepository {
  public async create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenDocument> {
    return PasswordResetTokenModel.create(input);
  }

  public async findActiveByHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenDocument | null> {
    return PasswordResetTokenModel.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    }).exec();
  }

  public async markUsed(id: string, usedAt: Date): Promise<void> {
    await PasswordResetTokenModel.findByIdAndUpdate(id, { usedAt }).exec();
  }
}
