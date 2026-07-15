import { StatusCodes } from 'http-status-codes';

import { UserRole, UserStatus } from '@finguard/shared';

import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import type { UserDocument } from '../models/user.model';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import type { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository';
import type { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import type { CreateUserInput, UserRepository } from '../repositories/user.repository';
import { getDocumentId } from '../utils/document-id';
import type { PasswordService } from './password.service';
import type { TokenService } from './token.service';
import type { AuthTokenResponse, PublicUser, RequestContext } from './auth.types';

export interface AuthServiceDependencies {
  readonly userRepository: UserRepository;
  readonly refreshTokenRepository: RefreshTokenRepository;
  readonly emailVerificationTokenRepository: EmailVerificationTokenRepository;
  readonly passwordResetTokenRepository: PasswordResetTokenRepository;
  readonly auditLogRepository: AuditLogRepository;
  readonly passwordService: PasswordService;
  readonly tokenService: TokenService;
}

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface AuthResult {
  readonly user: PublicUser;
  readonly tokens: AuthTokenResponse;
}

export interface RegisterResult {
  readonly user: PublicUser;
  readonly emailVerificationToken: string;
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toPublicUser = (user: UserDocument): PublicUser => ({
  id: getDocumentId(user),
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role as UserRole,
  status: user.status as UserStatus,
  isEmailVerified: user.isEmailVerified,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export class AuthService {
  public constructor(private readonly dependencies: AuthServiceDependencies) {}

  public async register(input: RegisterInput, context: RequestContext): Promise<RegisterResult> {
    const email = normalizeEmail(input.email);
    const existingUser = await this.dependencies.userRepository.existsByEmail(email);

    if (existingUser) {
      throw new AppError({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'A user with this email already exists',
        statusCode: StatusCodes.CONFLICT,
      });
    }

    const passwordHash = await this.dependencies.passwordService.hash(input.password);
    const user = await this.dependencies.userRepository.create({
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      isEmailVerified: false,
    } satisfies CreateUserInput);
    const verificationToken = this.dependencies.tokenService.createEmailVerificationToken();

    await this.dependencies.emailVerificationTokenRepository.create({
      userId: getDocumentId(user),
      tokenHash: verificationToken.tokenHash,
      expiresAt: verificationToken.expiresAt,
    });
    await this.audit(user, 'REGISTER', context, { email });

    return {
      user: toPublicUser(user),
      emailVerificationToken: verificationToken.token,
    };
  }

  public async login(input: LoginInput, context: RequestContext): Promise<AuthResult> {
    const user = await this.dependencies.userRepository.findByEmailWithPassword(input.email);

    if (!user) {
      throw this.invalidCredentials();
    }

    this.assertActiveUser(user);
    this.assertNotLocked(user);

    const passwordMatches = await this.dependencies.passwordService.verify(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      await this.recordFailedLogin(user);
      await this.audit(user, 'LOGIN_FAILURE', context, { email: normalizeEmail(input.email) });
      throw this.invalidCredentials();
    }

    await this.dependencies.userRepository.recordSuccessfulLogin(getDocumentId(user), new Date());
    await this.audit(user, 'LOGIN_SUCCESS', context);

    return this.issueTokens(user, context);
  }

  public async refresh(refreshToken: string, context: RequestContext): Promise<AuthResult> {
    const tokenHash = this.dependencies.tokenService.hashOpaqueToken(refreshToken);
    const existingToken = await this.dependencies.refreshTokenRepository.findActiveByHash(
      tokenHash,
      new Date(),
    );

    if (!existingToken) {
      throw new AppError({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
    }

    const user = await this.dependencies.userRepository.findById(existingToken.userId.toString());

    if (!user) {
      throw new AppError({
        code: 'USER_NOT_FOUND',
        message: 'Refresh token user was not found',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
    }

    this.assertActiveUser(user);
    await this.dependencies.refreshTokenRepository.revokeById(
      getDocumentId(existingToken),
      new Date(),
    );
    await this.audit(user, 'TOKEN_REFRESH', context);

    return this.issueTokens(user, context);
  }

  public async logout(refreshToken: string, context: RequestContext): Promise<void> {
    const tokenHash = this.dependencies.tokenService.hashOpaqueToken(refreshToken);
    const existingToken = await this.dependencies.refreshTokenRepository.findActiveByHash(
      tokenHash,
      new Date(),
    );

    await this.dependencies.refreshTokenRepository.revokeByHash(tokenHash, new Date());

    if (!existingToken) {
      return;
    }

    const user = await this.dependencies.userRepository.findById(existingToken.userId.toString());

    if (user) {
      await this.dependencies.userRepository.incrementSessionVersion(getDocumentId(user));
      await this.audit(user, 'LOGOUT', context);
    }
  }

  public async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.dependencies.userRepository.findById(userId);

    if (!user) {
      throw new AppError({
        code: 'USER_NOT_FOUND',
        message: 'Authenticated user was not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    return toPublicUser(user);
  }

  public async verifyEmail(token: string, context: RequestContext): Promise<PublicUser> {
    const tokenHash = this.dependencies.tokenService.hashOpaqueToken(token);
    const verificationToken =
      await this.dependencies.emailVerificationTokenRepository.findActiveByHash(
        tokenHash,
        new Date(),
      );

    if (!verificationToken) {
      throw new AppError({
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'Email verification token is invalid or expired',
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    const user = await this.dependencies.userRepository.markEmailVerified(
      verificationToken.userId.toString(),
    );
    await this.dependencies.emailVerificationTokenRepository.markUsed(
      getDocumentId(verificationToken),
      new Date(),
    );

    if (!user) {
      throw new AppError({
        code: 'USER_NOT_FOUND',
        message: 'Verification token user was not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    await this.audit(user, 'EMAIL_VERIFIED', context);
    return toPublicUser(user);
  }

  public async resendVerification(
    email: string,
    context: RequestContext,
  ): Promise<{
    readonly accepted: true;
    readonly emailVerificationToken?: string;
  }> {
    const user = await this.dependencies.userRepository.findByEmail(email);

    if (!user || user.isEmailVerified) {
      return { accepted: true };
    }

    const verificationToken = this.dependencies.tokenService.createEmailVerificationToken();
    await this.dependencies.emailVerificationTokenRepository.create({
      userId: getDocumentId(user),
      tokenHash: verificationToken.tokenHash,
      expiresAt: verificationToken.expiresAt,
    });
    await this.audit(user, 'EMAIL_VERIFICATION_RESENT', context);

    return {
      accepted: true,
      emailVerificationToken: verificationToken.token,
    };
  }

  public async forgotPassword(
    email: string,
    context: RequestContext,
  ): Promise<{
    readonly accepted: true;
    readonly passwordResetToken?: string;
  }> {
    const user = await this.dependencies.userRepository.findByEmail(email);

    if (!user) {
      return { accepted: true };
    }

    const resetToken = this.dependencies.tokenService.createPasswordResetToken();
    await this.dependencies.passwordResetTokenRepository.create({
      userId: getDocumentId(user),
      tokenHash: resetToken.tokenHash,
      expiresAt: resetToken.expiresAt,
    });
    await this.audit(user, 'PASSWORD_RESET_REQUEST', context);

    return {
      accepted: true,
      passwordResetToken: resetToken.token,
    };
  }

  public async resetPassword(
    token: string,
    newPassword: string,
    context: RequestContext,
  ): Promise<void> {
    const tokenHash = this.dependencies.tokenService.hashOpaqueToken(token);
    const resetToken = await this.dependencies.passwordResetTokenRepository.findActiveByHash(
      tokenHash,
      new Date(),
    );

    if (!resetToken) {
      throw new AppError({
        code: 'INVALID_PASSWORD_RESET_TOKEN',
        message: 'Password reset token is invalid or expired',
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    const passwordHash = await this.dependencies.passwordService.hash(newPassword);
    const user = await this.dependencies.userRepository.updatePassword(
      resetToken.userId.toString(),
      passwordHash,
    );

    await this.dependencies.passwordResetTokenRepository.markUsed(
      getDocumentId(resetToken),
      new Date(),
    );
    await this.dependencies.refreshTokenRepository.revokeAllForUser(
      resetToken.userId.toString(),
      new Date(),
    );

    if (user) {
      await this.dependencies.userRepository.incrementSessionVersion(getDocumentId(user));
      await this.audit(user, 'PASSWORD_RESET_SUCCESS', context);
    }
  }

  private async issueTokens(user: UserDocument, context: RequestContext): Promise<AuthResult> {
    const accessToken = this.dependencies.tokenService.createAccessToken({
      sub: getDocumentId(user),
      role: user.role as UserRole,
      sessionVersion: user.sessionVersion ?? 0,
    });
    const refreshToken = this.dependencies.tokenService.createRefreshToken();

    await this.dependencies.refreshTokenRepository.create({
      userId: getDocumentId(user),
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
      deviceInfo: {
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });

    return {
      user: toPublicUser(user),
      tokens: {
        accessToken,
        refreshToken: refreshToken.token,
        expiresIn: env.JWT_ACCESS_TTL,
        tokenType: 'Bearer',
      },
    };
  }

  private async recordFailedLogin(user: UserDocument): Promise<void> {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const lockedUntil =
      failedLoginAttempts >= env.AUTH_LOGIN_MAX_ATTEMPTS
        ? new Date(Date.now() + env.AUTH_LOCKOUT_MINUTES * 60 * 1000)
        : null;

    await this.dependencies.userRepository.recordFailedLogin(
      getDocumentId(user),
      failedLoginAttempts,
      lockedUntil,
    );
  }

  private assertActiveUser(user: UserDocument): void {
    if ((user.status as UserStatus) !== UserStatus.ACTIVE) {
      throw new AppError({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'Account is not active',
        statusCode: StatusCodes.FORBIDDEN,
      });
    }
  }

  private assertNotLocked(user: UserDocument): void {
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppError({
        code: 'ACCOUNT_LOCKED',
        message: 'Account is temporarily locked',
        statusCode: StatusCodes.LOCKED,
      });
    }
  }

  private invalidCredentials(): AppError {
    return new AppError({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  }

  private async audit(
    user: UserDocument,
    action: string,
    context: RequestContext,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.dependencies.auditLogRepository.create({
      userId: getDocumentId(user),
      action,
      resourceType: 'User',
      resourceId: getDocumentId(user),
      ipAddress: context.ipAddress,
      requestId: context.requestId,
      metadata,
    });
  }
}
