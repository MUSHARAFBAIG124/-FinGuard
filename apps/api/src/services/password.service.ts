import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { env } from '../config/env';

export const passwordPolicySchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character');

export class PasswordService {
  public validatePolicy(password: string): void {
    passwordPolicySchema.parse(password);
  }

  public async hash(password: string): Promise<string> {
    this.validatePolicy(password);
    return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  }

  public async verify(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
