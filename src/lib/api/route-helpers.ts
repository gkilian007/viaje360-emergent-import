import { NextResponse } from "next/server"
import { z, ZodError } from "zod"
import { createErrorBody, createSuccessBody, type ApiErrorCode } from "./responses"
import { captureException, recordTrace } from "@/lib/ops/observability"

interface ResponseOptions {
  requestId?: string
  details?: unknown
  route?: string
}

export function successResponse<T>(data: T, status = 200, requestId?: string) {
  return NextResponse.json(createSuccessBody(data, requestId), { status })
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown,
  requestId?: string
) {
  return NextResponse.json(createErrorBody(code, message, details, requestId), { status })
}

export function validationErrorResponse(error: ZodError, requestId?: string) {
  return errorResponse(
    "VALIDATION_ERROR",
    "Invalid request",
    400,
    z.flattenError(error),
    requestId
  )
}

export async function parseJsonBody<T>(req: Request, schema: z.ZodSchema<T>): Promise<T> {
  const body = await req.json()
  return schema.parse(body)
}

export function parseSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  return schema.parse(Object.fromEntries(searchParams.entries()))
}

export function normalizeRouteError(
  error: unknown,
  fallbackMessage: string,
  options?: ResponseOptions
) {
  const requestId = options?.requestId
  const route = options?.route ?? "unknown"

  if (error instanceof ZodError) {
    return validationErrorResponse(error, requestId)
  }

  const message = error instanceof Error ? error.message : fallbackMessage
  const details = {
    ...(options?.details && typeof options.details === "object" ? options.details : {}),
    route,
    timestamp: new Date().toISOString(),
  }

  captureException({ requestId: requestId ?? "unknown", route, error, meta: details })
  recordTrace({ requestId: requestId ?? "unknown", route, error, meta: details })

  return errorResponse("INTERNAL_ERROR", message, 500, details, requestId)
}
