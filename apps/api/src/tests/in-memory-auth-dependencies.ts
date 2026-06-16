import { Types } from 'mongoose';

import { UserStatus } from '@finguard/shared';

import type { AuditLogDocument } from '../models/audit-log.model';
import type { EmailVerificationTokenDocument } from '../models/email-verification-token.model';
import type { PasswordResetTokenDocument } from '../models/password-reset-token.model';
import type { RefreshTokenDocument } from '../models/refresh-token.model';
import type { UserDocument } from '../models/user.model';
import type { AuditLogRepository, CreateAuditLogInput } from '../repositories/audit-log.repository';
import type {
  CreateEmailVerificationTokenInput,
  EmailVerificationTokenRepository,
} from '../repositories/email-verification-token.repository';
import type {
  CreatePasswordResetTokenInput,
  PasswordResetTokenRepository,
} from '../repositories/password-reset-token.repository';
import type {
  CreateRefreshTokenInput,
  RefreshTokenRepository,
} from '../repositories/refresh-token.repository';
import type { CreateUserInput, UserRepository } from '../repositories/user.repository';
import { PasswordService } from '../services/password.service';
import { TokenService } from '../services/token.service';
import type { AuthRouterDependencies } from '../routes/auth.routes';

type StoredUser = UserDocument & {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
};

type StoredRefreshToken = RefreshTokenDocument & {
  revokedAt: Date | null;
};

type StoredEmailVerificationToken = EmailVerificationTokenDocument & {
  usedAt: Date | null;
};

type StoredPasswordResetToken = PasswordResetTokenDocument & {
  usedAt: Date | null;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const createUserDocument = (input: CreateUserInput): StoredUser => {
  const now = new Date();

  return {
    _id: new Types.ObjectId(),
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    status: input.status ?? UserStatus.ACTIVE,
    isEmailVerified: input.isEmailVerified ?? false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  } as StoredUser;
};

class InMemoryUserRepository implements UserRepository {
  public constructor(private readonly users: StoredUser[]) {}

  public create(input: CreateUserInput): Promise<UserDocument> {
    const user = createUserDocument(input);
    this.users.push(user);
    return Promise.resolve(user);
  }

  public findById(id: string): Promise<UserDocument | null> {
    return Promise.resolve(this.users.find((user) => user._id.toString() === id) ?? null);
  }

  public findByEmail(email: string): Promise<UserDocument | null> {
    const normalizedEmail = normalizeEmail(email);
    return Promise.resolve(this.users.find((user) => user.email === normalizedEmail) ?? null);
  }

  public async findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.findByEmail(email);
  }

  public async existsByEmail(email: string): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  public async markEmailVerified(id: string): Promise<UserDocument | null> {
    const user = await this.findById(id);

    if (!user) {
      return null;
    }

    user.isEmailVerified = true;
    user.updatedAt = new Date();
    return user;
  }

  public async updatePassword(id: string, passwordHash: string): Promise<UserDocument | null> {
    const user = (await this.findById(id)) as StoredUser | null;

    if (!user) {
      return null;
    }

    user.passwordHash = passwordHash;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.updatedAt = new Date();
    return user;
  }

  public async recordFailedLogin(
    id: string,
    failedLoginAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    const user = (await this.findById(id)) as StoredUser | null;

    if (!user) {
      return;
    }

    user.failedLoginAttempts = failedLoginAttempts;
    user.lockedUntil = lockedUntil;
    user.updatedAt = new Date();
  }

  public async recordSuccessfulLogin(id: string, loggedInAt: Date): Promise<void> {
    const user = (await this.findById(id)) as StoredUser | null;

    if (!user) {
      return;
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = loggedInAt;
    user.updatedAt = new Date();
  }
}

class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  public constructor(private readonly refreshTokens: StoredRefreshToken[]) {}

  public create(input: CreateRefreshTokenInput): Promise<RefreshTokenDocument> {
    const refreshToken = {
      _id: new Types.ObjectId(),
      ...input,
      userId: new Types.ObjectId(input.userId),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as StoredRefreshToken;

    this.refreshTokens.push(refreshToken);
    return Promise.resolve(refreshToken);
  }

  public findActiveByHash(tokenHash: string, now: Date): Promise<RefreshTokenDocument | null> {
    return Promise.resolve(
      this.refreshTokens.find(
        (token) =>
          token.tokenHash === tokenHash &&
          token.revokedAt === null &&
          token.expiresAt.getTime() > now.getTime(),
      ) ?? null,
    );
  }

  public revokeByHash(tokenHash: string, revokedAt: Date): Promise<void> {
    for (const token of this.refreshTokens) {
      if (token.tokenHash === tokenHash) {
        token.revokedAt = revokedAt;
      }
    }

    return Promise.resolve();
  }

  public revokeById(id: string, revokedAt: Date): Promise<void> {
    for (const token of this.refreshTokens) {
      if (token._id.toString() === id) {
        token.revokedAt = revokedAt;
      }
    }

    return Promise.resolve();
  }

  public revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    for (const token of this.refreshTokens) {
      if (token.userId.toString() === userId && token.revokedAt === null) {
        token.revokedAt = revokedAt;
      }
    }

    return Promise.resolve();
  }
}

class InMemoryEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  public constructor(private readonly tokens: StoredEmailVerificationToken[]) {}

  public create(input: CreateEmailVerificationTokenInput): Promise<EmailVerificationTokenDocument> {
    const token = {
      _id: new Types.ObjectId(),
      ...input,
      userId: new Types.ObjectId(input.userId),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as StoredEmailVerificationToken;

    this.tokens.push(token);
    return Promise.resolve(token);
  }

  public findActiveByHash(
    tokenHash: string,
    now: Date,
  ): Promise<EmailVerificationTokenDocument | null> {
    return Promise.resolve(
      this.tokens.find(
        (token) =>
          token.tokenHash === tokenHash &&
          token.usedAt === null &&
          token.expiresAt.getTime() > now.getTime(),
      ) ?? null,
    );
  }

  public markUsed(id: string, usedAt: Date): Promise<void> {
    for (const token of this.tokens) {
      if (token._id.toString() === id) {
        token.usedAt = usedAt;
      }
    }

    return Promise.resolve();
  }
}

class InMemoryPasswordResetTokenRepository implements PasswordResetTokenRepository {
  public constructor(private readonly tokens: StoredPasswordResetToken[]) {}

  public create(input: CreatePasswordResetTokenInput): Promise<PasswordResetTokenDocument> {
    const token = {
      _id: new Types.ObjectId(),
      ...input,
      userId: new Types.ObjectId(input.userId),
      usedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as StoredPasswordResetToken;

    this.tokens.push(token);
    return Promise.resolve(token);
  }

  public findActiveByHash(
    tokenHash: string,
    now: Date,
  ): Promise<PasswordResetTokenDocument | null> {
    return Promise.resolve(
      this.tokens.find(
        (token) =>
          token.tokenHash === tokenHash &&
          token.usedAt === null &&
          token.expiresAt.getTime() > now.getTime(),
      ) ?? null,
    );
  }

  public markUsed(id: string, usedAt: Date): Promise<void> {
    for (const token of this.tokens) {
      if (token._id.toString() === id) {
        token.usedAt = usedAt;
      }
    }

    return Promise.resolve();
  }
}

class InMemoryAuditLogRepository implements AuditLogRepository {
  public constructor(private readonly auditLogs: AuditLogDocument[]) {}

  public create(input: CreateAuditLogInput): Promise<AuditLogDocument> {
    const auditLog = {
      _id: new Types.ObjectId(),
      ...input,
      userId: new Types.ObjectId(input.userId),
      timestamp: new Date(),
    } as unknown as AuditLogDocument;

    this.auditLogs.push(auditLog);
    return Promise.resolve(auditLog);
  }

  public findByUserId(userId: string): Promise<readonly AuditLogDocument[]> {
    return Promise.resolve(this.auditLogs.filter((log) => log.userId.toString() === userId));
  }

  public findByResource(
    resourceType: string,
    resourceId: string,
  ): Promise<readonly AuditLogDocument[]> {
    return Promise.resolve(
      this.auditLogs.filter(
        (log) => log.resourceType === resourceType && log.resourceId === resourceId,
      ),
    );
  }
}

export interface InMemoryAuthStore {
  readonly users: StoredUser[];
  readonly refreshTokens: StoredRefreshToken[];
  readonly emailVerificationTokens: StoredEmailVerificationToken[];
  readonly passwordResetTokens: StoredPasswordResetToken[];
  readonly auditLogs: AuditLogDocument[];
}

export const createInMemoryAuthDependencies = (): {
  readonly dependencies: AuthRouterDependencies;
  readonly store: InMemoryAuthStore;
} => {
  const store: InMemoryAuthStore = {
    users: [],
    refreshTokens: [],
    emailVerificationTokens: [],
    passwordResetTokens: [],
    auditLogs: [],
  };
  const passwordService = new PasswordService();
  const tokenService = new TokenService();

  return {
    store,
    dependencies: {
      userRepository: new InMemoryUserRepository(store.users),
      refreshTokenRepository: new InMemoryRefreshTokenRepository(store.refreshTokens),
      emailVerificationTokenRepository: new InMemoryEmailVerificationTokenRepository(
        store.emailVerificationTokens,
      ),
      passwordResetTokenRepository: new InMemoryPasswordResetTokenRepository(
        store.passwordResetTokens,
      ),
      auditLogRepository: new InMemoryAuditLogRepository(store.auditLogs),
      passwordService,
      tokenService,
    },
  };
};
