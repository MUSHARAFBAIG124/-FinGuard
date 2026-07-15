import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

import { AppError } from '../errors/app-error';
import { MongooseUserRepository } from '../repositories/user.repository';
import { TokenService } from '../services/token.service';

interface AccessTokenSession {
  readonly sessionVersion?: number;
}

interface AccessTokenSessionRepository {
  findById(id: string): Promise<AccessTokenSession | null>;
}

const extractBearerToken = (authorizationHeader: string | undefined): string => {
  if (!authorizationHeader) {
    throw new AppError({
      code: 'MISSING_TOKEN',
      message: 'Authorization bearer token is required',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError({
      code: 'MALFORMED_TOKEN',
      message: 'Authorization header must use the Bearer scheme',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  }

  return token;
};

const verifyActiveAccessToken = async (
  token: string,
  tokenService: TokenService,
  userRepository: AccessTokenSessionRepository,
) => {
  const auth = tokenService.verifyAccessToken(token);
  const user = await userRepository.findById(auth.sub);

  if (!user || (user.sessionVersion ?? 0) !== auth.sessionVersion) {
    throw new AppError({
      code: 'TOKEN_REVOKED',
      message: 'Access token has been revoked',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  }

  return auth;
};

export const createJwtMiddleware =
  (
    tokenService: TokenService,
    userRepository: AccessTokenSessionRepository = new MongooseUserRepository(),
  ): RequestHandler =>
  async (request, _response, next) => {
    try {
      const token = extractBearerToken(request.headers.authorization);
      const auth = await verifyActiveAccessToken(token, tokenService, userRepository);

      request.auth = auth;

      next();
    } catch (error) {
      next(error);
    }
  };

export const requireJwt: RequestHandler = createJwtMiddleware(new TokenService());
