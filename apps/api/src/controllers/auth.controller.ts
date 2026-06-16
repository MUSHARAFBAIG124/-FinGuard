import type { Request, RequestHandler, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../config/env';
import { AppError } from '../errors/app-error';
import type { AuthService } from '../services/auth.service';
import type { AuthTokenResponse, PublicUser, RequestContext } from '../services/auth.types';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

interface AuthBody {
  readonly email: string;
  readonly password: string;
}

interface RegisterBody extends AuthBody {
  readonly firstName: string;
  readonly lastName: string;
}

interface TokenBody {
  readonly token: string;
}

interface ResetPasswordBody extends TokenBody {
  readonly password: string;
}

interface AuthResponseData {
  readonly user: PublicUser;
  readonly tokens: AuthTokenResponse;
}

const getRequestContext = (request: Request): RequestContext => ({
  requestId: request.requestId,
  ipAddress: request.ip ?? 'unknown',
  userAgent: request.header('user-agent') ?? 'unknown',
});

const getCookieRefreshToken = (request: Request): string | undefined => {
  const cookieHeader = request.header('cookie');

  if (!cookieHeader) {
    return undefined;
  }

  const cookiesFromHeader = new Map(
    cookieHeader.split(';').map((part) => {
      const [key, ...value] = part.trim().split('=');
      return [key, decodeURIComponent(value.join('='))] as const;
    }),
  );

  return cookiesFromHeader.get(env.REFRESH_TOKEN_COOKIE_NAME);
};

const setRefreshCookie = (response: Response, refreshToken: string): void => {
  response.cookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
};

const clearRefreshCookie = (response: Response): void => {
  response.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
  });
};

const resolveRefreshToken = (request: Request): string => {
  const refreshToken =
    (request.body as { refreshToken?: string }).refreshToken ?? getCookieRefreshToken(request);

  if (!refreshToken) {
    throw new AppError({
      code: 'MISSING_REFRESH_TOKEN',
      message: 'Refresh token is required',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  }

  return refreshToken;
};

export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  public register: RequestHandler = asyncHandler(async (request, response) => {
    const result = await this.authService.register(
      request.body as {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
      } satisfies RegisterBody,
      getRequestContext(request),
    );

    sendSuccess(response, {
      statusCode: StatusCodes.CREATED,
      data: {
        user: result.user,
        emailVerification: {
          delivery: 'not_configured',
          token: result.emailVerificationToken,
        },
      },
    });
  });

  public login: RequestHandler = asyncHandler(async (request, response) => {
    const result = await this.authService.login(
      request.body as {
        email: string;
        password: string;
      } satisfies AuthBody,
      getRequestContext(request),
    );

    setRefreshCookie(response, result.tokens.refreshToken);
    sendSuccess(response, {
      data: {
        user: result.user,
        tokens: result.tokens,
      } satisfies AuthResponseData,
    });
  });

  public refresh: RequestHandler = asyncHandler(async (request, response) => {
    const result = await this.authService.refresh(
      resolveRefreshToken(request),
      getRequestContext(request),
    );

    setRefreshCookie(response, result.tokens.refreshToken);
    sendSuccess(response, {
      data: {
        user: result.user,
        tokens: result.tokens,
      } satisfies AuthResponseData,
    });
  });

  public logout: RequestHandler = asyncHandler(async (request, response) => {
    await this.authService.logout(resolveRefreshToken(request), getRequestContext(request));
    clearRefreshCookie(response);

    sendSuccess(response, {
      data: {
        loggedOut: true,
      },
    });
  });

  public me: RequestHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
      throw new AppError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
    }

    const user = await this.authService.getCurrentUser(request.auth.sub);

    sendSuccess(response, {
      data: {
        user,
      },
    });
  });

  public verifyEmail: RequestHandler = asyncHandler(async (request, response) => {
    const user = await this.authService.verifyEmail(
      (request.body as { token: string }).token,
      getRequestContext(request),
    );

    sendSuccess(response, {
      data: {
        user,
        verified: true,
      },
    });
  });

  public resendVerification: RequestHandler = asyncHandler(async (request, response) => {
    const result = await this.authService.resendVerification(
      (request.body as { email: string }).email,
      getRequestContext(request),
    );

    sendSuccess(response, {
      data: {
        emailVerification: {
          delivery: 'not_configured',
          token: result.emailVerificationToken,
        },
        accepted: result.accepted,
      },
    });
  });

  public forgotPassword: RequestHandler = asyncHandler(async (request, response) => {
    const result = await this.authService.forgotPassword(
      (request.body as { email: string }).email,
      getRequestContext(request),
    );

    sendSuccess(response, {
      data: {
        passwordReset: {
          delivery: 'not_configured',
          token: result.passwordResetToken,
        },
        accepted: result.accepted,
      },
    });
  });

  public resetPassword: RequestHandler = asyncHandler(async (request, response) => {
    const body = request.body as ResetPasswordBody;

    await this.authService.resetPassword(body.token, body.password, getRequestContext(request));

    sendSuccess(response, {
      data: {
        reset: true,
      },
    });
  });
}
