import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

import { AppError } from '../errors/app-error';
import { TokenService } from '../services/token.service';

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

export const createJwtMiddleware =
  (tokenService: TokenService): RequestHandler =>
  (request, _response, next) => {
    try {
      const token = extractBearerToken(request.headers.authorization);
      const auth = tokenService.verifyAccessToken(token);

      request.auth = auth;

      next();
    } catch (error) {
      next(error);
    }
  };

export const requireJwt: RequestHandler = createJwtMiddleware(new TokenService());

export const optionalJwt: RequestHandler = (request, _response, next) => {
  try {
    if (!request.headers.authorization) {
      next();
      return;
    }

    const token = extractBearerToken(request.headers.authorization);
    const auth = new TokenService().verifyAccessToken(token);

    request.auth = auth;
    next();
  } catch (error) {
    next(error);
  }
};
