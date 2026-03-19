/**
 * Discriminated union of all recoverable domain errors.
 * Infrastructure errors (DB down, network failure) still throw —
 * they are unrecoverable within business logic.
 */
export type AppError = AuthError | ValidationError | NotFoundError | ConflictError | FileError;

export interface AuthError {
  readonly type: 'AUTH_ERROR';
  readonly message: string;
}

export interface ValidationError {
  readonly type: 'VALIDATION_ERROR';
  readonly message: string;
  readonly fields?: Readonly<Record<string, string>>;
}

export interface NotFoundError {
  readonly type: 'NOT_FOUND';
  readonly resource: string;
  readonly id: string;
}

export interface ConflictError {
  readonly type: 'CONFLICT';
  readonly message: string;
}

export interface FileError {
  readonly type: 'FILE_ERROR';
  readonly message: string;
  readonly code: 'INVALID_TYPE' | 'TOO_LARGE' | 'PARSE_FAILED' | 'TOO_MANY_ROWS' | 'TOO_MANY_COLUMNS';
}

/** Maps a domain error to an HTTP Response at the API boundary. */
export function errorResponse(error: AppError): Response {
  const statusMap: Record<AppError['type'], number> = {
    AUTH_ERROR: 401,
    VALIDATION_ERROR: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    FILE_ERROR: 422,
  };

  const message = error.type === 'NOT_FOUND' ? `${error.resource} not found: ${error.id}` : error.message;

  return Response.json({ error: error.type, message }, { status: statusMap[error.type] });
}
