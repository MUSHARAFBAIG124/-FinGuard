import express from 'express';

import { API_PREFIX } from '@finguard/shared';

import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestContextMiddleware } from './middleware/request-context.middleware';
import { configureSecurityMiddleware } from './middleware/security.middleware';
import { createApiRouter, type ApiRouterOptions } from './routes';

export type AppOptions = ApiRouterOptions;

export const createApp = (options: AppOptions = {}): express.Express => {
  const app = express();

  app.use(requestContextMiddleware);
  configureSecurityMiddleware(app);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use(API_PREFIX, createApiRouter(options));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
