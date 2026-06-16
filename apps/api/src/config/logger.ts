import winston from 'winston';

import { env } from './env';

const withDefaultRequestId = winston.format((info) => {
  info.requestId ??= 'system';
  return info;
});

const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  withDefaultRequestId(),
  winston.format.printf(({ timestamp, level, message, requestId, ...metadata }) => {
    const suffix = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
    return `${String(timestamp)} ${level} [${String(requestId)}] ${String(message)}${suffix}`;
  }),
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  withDefaultRequestId(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: {
    service: 'finguard-api',
  },
  format: env.NODE_ENV === 'development' ? developmentFormat : productionFormat,
  transports: [new winston.transports.Console()],
});

export const createRequestLogger = (requestId: string): winston.Logger =>
  logger.child({ requestId });
