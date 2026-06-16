import { createServer } from 'node:http';

import { createApp } from './app';
import { disconnectDatabase, connectDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';

const app = createApp();
const server = createServer(app);

let shuttingDown = false;

const shutdown = (reason: string): void => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info('Graceful shutdown started', { reason });

  server.close((error?: Error) => {
    if (error) {
      logger.error('HTTP server shutdown failed', { error });
      process.exit(1);
    }

    void (async () => {
      try {
        await disconnectDatabase();
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (shutdownError) {
        logger.error('Graceful shutdown failed', { error: shutdownError });
        process.exit(1);
      }
    })();
  });

  setTimeout(() => {
    logger.error('Graceful shutdown timed out');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  shutdown('unhandledRejection');
});

try {
  await connectDatabase();

  server.listen(env.API_PORT, () => {
    logger.info('FinGuard API server listening', {
      port: env.API_PORT,
      baseUrl: env.API_BASE_URL,
    });
  });
} catch (error) {
  logger.error('API server failed to start', { error });
  process.exit(1);
}
