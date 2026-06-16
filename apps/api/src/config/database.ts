import mongoose from 'mongoose';

import { env } from './env';
import { logger } from './logger';

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'disconnecting';

const readyStateMap: Record<number, DatabaseStatus> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export const getDatabaseStatus = (): DatabaseStatus =>
  readyStateMap[mongoose.connection.readyState] ?? 'disconnected';

export const isDatabaseReady = (): boolean => getDatabaseStatus() === 'connected';

export const connectDatabase = async (): Promise<void> => {
  if (isDatabaseReady()) {
    return;
  }

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  logger.info('MongoDB connection established');
};

export const disconnectDatabase = async (): Promise<void> => {
  if (getDatabaseStatus() === 'disconnected') {
    return;
  }

  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
};
