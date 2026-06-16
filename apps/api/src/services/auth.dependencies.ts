import {
  MongooseAuditLogRepository,
  MongooseEmailVerificationTokenRepository,
  MongoosePasswordResetTokenRepository,
  MongooseRefreshTokenRepository,
  MongooseUserRepository,
} from '../repositories';
import { AuthService, type AuthServiceDependencies } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

export const createAuthServiceDependencies = (): AuthServiceDependencies => ({
  userRepository: new MongooseUserRepository(),
  refreshTokenRepository: new MongooseRefreshTokenRepository(),
  emailVerificationTokenRepository: new MongooseEmailVerificationTokenRepository(),
  passwordResetTokenRepository: new MongoosePasswordResetTokenRepository(),
  auditLogRepository: new MongooseAuditLogRepository(),
  passwordService: new PasswordService(),
  tokenService: new TokenService(),
});

export const createAuthService = (): AuthService =>
  new AuthService(createAuthServiceDependencies());
