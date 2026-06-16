import {
  EmailVerificationTokenModel,
  type EmailVerificationTokenDocument,
} from '../models/email-verification-token.model';

export interface CreateEmailVerificationTokenInput {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface EmailVerificationTokenRepository {
  create(input: CreateEmailVerificationTokenInput): Promise<EmailVerificationTokenDocument>;
  findActiveByHash(tokenHash: string, now: Date): Promise<EmailVerificationTokenDocument | null>;
  markUsed(id: string, usedAt: Date): Promise<void>;
}

export class MongooseEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  public async create(
    input: CreateEmailVerificationTokenInput,
  ): Promise<EmailVerificationTokenDocument> {
    return EmailVerificationTokenModel.create(input);
  }

  public async findActiveByHash(
    tokenHash: string,
    now: Date,
  ): Promise<EmailVerificationTokenDocument | null> {
    return EmailVerificationTokenModel.findOne({
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: now },
    }).exec();
  }

  public async markUsed(id: string, usedAt: Date): Promise<void> {
    await EmailVerificationTokenModel.findByIdAndUpdate(id, { usedAt }).exec();
  }
}
