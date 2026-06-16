import { RefreshTokenModel, type RefreshTokenDocument } from '../models/refresh-token.model';

export interface DeviceInfo {
  readonly userAgent: string;
  readonly ipAddress: string;
}

export interface CreateRefreshTokenInput {
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly deviceInfo: DeviceInfo;
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenDocument>;
  findActiveByHash(tokenHash: string, now: Date): Promise<RefreshTokenDocument | null>;
  revokeByHash(tokenHash: string, revokedAt: Date): Promise<void>;
  revokeById(id: string, revokedAt: Date): Promise<void>;
  revokeAllForUser(userId: string, revokedAt: Date): Promise<void>;
}

export class MongooseRefreshTokenRepository implements RefreshTokenRepository {
  public async create(input: CreateRefreshTokenInput): Promise<RefreshTokenDocument> {
    return RefreshTokenModel.create(input);
  }

  public async findActiveByHash(
    tokenHash: string,
    now: Date,
  ): Promise<RefreshTokenDocument | null> {
    return RefreshTokenModel.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    }).exec();
  }

  public async revokeByHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await RefreshTokenModel.updateOne({ tokenHash }, { revokedAt }).exec();
  }

  public async revokeById(id: string, revokedAt: Date): Promise<void> {
    await RefreshTokenModel.findByIdAndUpdate(id, { revokedAt }).exec();
  }

  public async revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    await RefreshTokenModel.updateMany(
      {
        userId,
        revokedAt: null,
      },
      { revokedAt },
    ).exec();
  }
}
