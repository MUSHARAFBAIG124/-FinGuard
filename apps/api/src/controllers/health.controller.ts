import type { RequestHandler } from 'express';

import { env } from '../config/env';
import { getDatabaseStatus, isDatabaseReady } from '../config/database';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

type DependencyState = 'ok' | 'degraded' | 'unavailable';

const probeAiService = async (): Promise<{
  status: DependencyState;
  url: string;
  latencyMs: number;
}> => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_HEALTH_TIMEOUT_MS);
  const healthUrl = new URL('/health', env.AI_SERVICE_BASE_URL).toString();

  try {
    const response = await fetch(healthUrl, { signal: controller.signal });

    return {
      status: response.ok ? 'ok' : 'degraded',
      url: healthUrl,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      status: 'unavailable',
      url: healthUrl,
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const getLiveness: RequestHandler = (_request, response) => {
  sendSuccess(response, {
    data: {
      status: 'ok',
      service: 'finguard-api',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
};

export const getDatabaseHealth: RequestHandler = (_request, response) => {
  const status = getDatabaseStatus();

  sendSuccess(response, {
    data: {
      status: isDatabaseReady() ? 'ok' : 'unavailable',
      dependency: 'mongodb',
      connectionState: status,
    },
  });
};

export const getAiHealth: RequestHandler = asyncHandler(async (_request, response) => {
  const aiHealth = await probeAiService();

  sendSuccess(response, {
    data: {
      dependency: 'ai-service',
      phase: 'planned-phase-6',
      ...aiHealth,
    },
  });
});

export const getReadiness: RequestHandler = asyncHandler(async (_request, response) => {
  const aiHealth = await probeAiService();
  const databaseReady = isDatabaseReady();

  sendSuccess(response, {
    data: {
      status: databaseReady ? 'ok' : 'degraded',
      dependencies: {
        mongodb: {
          required: true,
          status: databaseReady ? 'ok' : 'unavailable',
          connectionState: getDatabaseStatus(),
        },
        aiService: {
          required: false,
          ...aiHealth,
        },
      },
    },
  });
});
