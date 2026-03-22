export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR"
  | "BAD_GATEWAY"
  | "TOO_MANY_REQUESTS"

export interface ApiSuccessBody<T> {
  ok: true
  data: T
}

export interface ApiErrorBody {
  ok: false
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
  }
  request_id?: string
}

export function createSuccessBody<T>(data: T, requestId?: string): ApiSuccessBody<T> & { request_id?: string } {
  return {
    ok: true,
    data,
    ...(requestId ? { request_id: requestId } : {}),
  }
}

export function createErrorBody(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  requestId?: string
): ApiErrorBody {
  return {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
    ...(requestId ? { request_id: requestId } : {}),
  }
}
