import cors from 'cors';
import type { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { StatusCodes } from 'http-status-codes';

import { env } from '../config/env';
import { AppError } from '../errors/app-error';

const allowedOrigins = new Set([
  env.WEB_BASE_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

export const configureSecurityMiddleware = (app: Express): void => {
  app.disable('x-powered-by');

  app.use(helmet());

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(
          new AppError({
            code: 'CORS_FORBIDDEN',
            message: 'Origin is not allowed',
            statusCode: StatusCodes.FORBIDDEN,
          }),
        );
      },
    }),
  );

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_request: Request, response: Response) => {
        response.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please retry later.',
          },
          meta: {
            requestId: response.req.requestId,
          },
        });
      },
    }),
  );
};
