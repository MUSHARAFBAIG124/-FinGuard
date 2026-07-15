import { Router } from 'express';

import { AuthController } from '../controllers/auth.controller';
import { createJwtMiddleware } from '../middleware/jwt.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { AuthService } from '../services/auth.service';
import type { AuthServiceDependencies } from '../services/auth.service';
import type { TokenService } from '../services/token.service';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validators';

export interface AuthRouterDependencies extends AuthServiceDependencies {
  readonly tokenService: TokenService;
}

export const createAuthRouter = (dependencies: AuthRouterDependencies): Router => {
  const router = Router();
  const authService = new AuthService(dependencies);
  const controller = new AuthController(authService);
  const requireJwt = createJwtMiddleware(dependencies.tokenService, dependencies.userRepository);

  router.post('/register', validateRequest({ body: registerSchema }), controller.register);
  router.post('/login', validateRequest({ body: loginSchema }), controller.login);
  router.post('/refresh', validateRequest({ body: refreshSchema }), controller.refresh);
  router.post('/logout', validateRequest({ body: logoutSchema }), controller.logout);
  router.get('/me', requireJwt, controller.me);
  router.post(
    '/verify-email',
    validateRequest({ body: verifyEmailSchema }),
    controller.verifyEmail,
  );
  router.post(
    '/resend-verification',
    validateRequest({ body: resendVerificationSchema }),
    controller.resendVerification,
  );
  router.post(
    '/forgot-password',
    validateRequest({ body: forgotPasswordSchema }),
    controller.forgotPassword,
  );
  router.post(
    '/reset-password',
    validateRequest({ body: resetPasswordSchema }),
    controller.resetPassword,
  );

  return router;
};
