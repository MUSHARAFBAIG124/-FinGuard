import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

type RequestValidationSchema = {
  body?: ZodType<unknown>;
  params?: ZodType<unknown>;
  query?: ZodType<unknown>;
};

export const validateRequest =
  (schema: RequestValidationSchema): RequestHandler =>
  (request, _response, next) => {
    try {
      if (schema.body) {
        request.body = schema.body.parse(request.body);
      }

      if (schema.params) {
        request.params = schema.params.parse(request.params) as typeof request.params;
      }

      if (schema.query) {
        request.query = schema.query.parse(request.query) as typeof request.query;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
