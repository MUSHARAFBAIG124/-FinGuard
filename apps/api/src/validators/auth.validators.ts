import { z } from 'zod';

import { passwordPolicySchema } from '../services/password.service';

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: passwordPolicySchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32).optional(),
});

export const logoutSchema = refreshSchema;

export const verifyEmailSchema = z.object({
  token: z.string().min(32),
});

export const resendVerificationSchema = z.object({
  email: z.string().email().max(320),
});

export const forgotPasswordSchema = resendVerificationSchema;

export const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: passwordPolicySchema,
});
