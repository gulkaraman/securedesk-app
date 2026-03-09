export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DB_ERROR'
  | 'FORBIDDEN'
  | 'UNKNOWN'

export interface AppError {
  code: AppErrorCode
  message: string
  details?: Record<string, string> | undefined
}

export class AppErrorBase extends Error {
  public readonly code: AppErrorCode
  public readonly details?: Record<string, string> | undefined

  public constructor(code: AppErrorCode, message: string, details?: Record<string, string>) {
    super(message)
    this.code = code
    this.details = details
  }
}

export class ValidationError extends AppErrorBase {
  public constructor(message: string, details?: Record<string, string>) {
    super('VALIDATION_ERROR', message, details)
  }
}

export class NotFoundError extends AppErrorBase {
  public constructor(message: string, details?: Record<string, string>) {
    super('NOT_FOUND', message, details)
  }
}

export class ConflictError extends AppErrorBase {
  public constructor(message: string, details?: Record<string, string>) {
    super('CONFLICT', message, details)
  }
}

export class DbError extends AppErrorBase {
  public constructor(message: string, details?: Record<string, string>) {
    super('DB_ERROR', message, details)
  }
}

export class ForbiddenError extends AppErrorBase {
  public constructor(message: string, details?: Record<string, string>) {
    super('FORBIDDEN', message, details)
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppErrorBase) {
    const base: AppError = { code: err.code, message: err.message }
    if (err.details !== undefined) base.details = err.details
    return base
  }
  if (err instanceof Error) {
    const raw = err.message
    if (/FOREIGN KEY|constraint failed|SQLITE_ERROR/i.test(raw)) {
      return {
        code: 'DB_ERROR',
        message: 'Veritabanı işlemi sırasında bir hata oluştu.'
      }
    }
    return { code: 'UNKNOWN', message: raw }
  }
  return { code: 'UNKNOWN', message: 'Unknown error' }
}

