import type { AppError } from './errors'

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function err(error: AppError): Result<never> {
  return { ok: false, error }
}

/**
 * Throws if the result is an error; returns the value otherwise.
 * Use in renderer when you want to surface errors via UI (e.g. catch and setError).
 */
export function unwrap<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(r.error.message)
  return r.value
}

