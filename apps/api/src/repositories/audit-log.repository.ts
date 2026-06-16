import type { AuditLogDocument } from '../models/audit-log.model';
import { AuditLogModel } from '../models/audit-log.model';

export interface CreateAuditLogInput {
  readonly userId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ipAddress: string;
  readonly requestId: string;
  readonly metadata?: Record<string, unknown>;
}

export interface AuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLogDocument>;
  findByUserId(userId: string): Promise<readonly AuditLogDocument[]>;
  findByResource(resourceType: string, resourceId: string): Promise<readonly AuditLogDocument[]>;
}

export class MongooseAuditLogRepository implements AuditLogRepository {
  public async create(input: CreateAuditLogInput): Promise<AuditLogDocument> {
    return AuditLogModel.create(input);
  }

  public async findByUserId(userId: string): Promise<readonly AuditLogDocument[]> {
    return AuditLogModel.find({ userId }).sort({ timestamp: -1 }).exec();
  }

  public async findByResource(
    resourceType: string,
    resourceId: string,
  ): Promise<readonly AuditLogDocument[]> {
    return AuditLogModel.find({ resourceType, resourceId }).sort({ timestamp: -1 }).exec();
  }
}
