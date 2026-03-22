export interface ObservabilityEvent {
  requestId: string
  route: string
  error?: unknown
  meta?: Record<string, unknown>
}

/**
 * Optional integration point for Sentry.
 * No hard dependency: only calls global capture helper if present.
 */
export function captureException(event: ObservabilityEvent) {
  const sentry = (globalThis as Record<string, unknown>).__VIAJE360_SENTRY_CAPTURE__
  if (typeof sentry === "function") {
    ;(sentry as (payload: ObservabilityEvent) => void)(event)
  }
}

/**
 * Optional integration point for OpenTelemetry/custom tracing.
 */
export function recordTrace(event: ObservabilityEvent) {
  const tracer = (globalThis as Record<string, unknown>).__VIAJE360_TRACE_HOOK__
  if (typeof tracer === "function") {
    ;(tracer as (payload: ObservabilityEvent) => void)(event)
  }
}
