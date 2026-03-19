import 'server-only';

import { z, type ZodSchema } from 'zod/v4';
import { getCurrentUser } from '@/lib/auth';
import type { CurrentUser } from '@/lib/auth';
import type { ValidationError } from '@/types/errors';

export interface AuthContext {
  readonly user: CurrentUser;
}

type AuthenticatedHandler<TContext extends object = object> = (
  req: Request,
  ctx: TContext & AuthContext,
) => Promise<Response>;

export function withAuthHandler<TContext extends object = object>(handler: AuthenticatedHandler<TContext>) {
  return async (req: Request, ctx?: TContext): Promise<Response> => {
    const user = await getCurrentUser();

    return handler(req, {
      ...(ctx ?? ({} as TContext)),
      user,
    });
  };
}

function validationError(message: string, fields?: Readonly<Record<string, string>>): ValidationError {
  return {
    type: 'VALIDATION_ERROR',
    message,
    fields,
  };
}

export function invalidRequestError(message = 'Invalid request payload'): ValidationError {
  return validationError(message);
}

export async function parseJsonBody<TSchema extends ZodSchema>(
  req: Request,
  schema: TSchema,
): Promise<{ success: true; data: z.infer<TSchema> } | { success: false; error: ValidationError }> {
  let parsedJson: unknown;

  try {
    const text = await req.text();
    parsedJson = text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      error: invalidRequestError('Request body must be valid JSON'),
    };
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    return {
      success: false,
      error: invalidRequestError('Request body did not match the expected shape'),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
