export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string }

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function apiSuccess<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}

export function apiFailure<T>(message: string): ApiResult<T> {
  return { ok: false, message }
}
