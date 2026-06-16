import type { Logger } from 'winston';

import type { UserRole } from '@finguard/shared';

export interface AuthPayload {
  readonly sub: string;
  readonly role: UserRole;
  readonly tokenType: 'access';
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      log?: Logger;
      requestId: string;
    }
  }
}
