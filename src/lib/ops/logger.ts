export interface StructuredLogEntry {
  requestId: string
  route: string
  duration: number
  status: number
  error?: string
  meta?: Record<string, unknown>
}

/**
 * Emits structured JSON logs for request tracing.
 */
export function structuredLog(entry: StructuredLogEntry) {
  const payload = {
    level: entry.status >= 500 ? "error" : entry.status >= 400 ? "warn" : "info",
    timestamp: new Date().toISOString(),
    request_id: entry.requestId,
    route: entry.route,
    duration_ms: entry.duration,
    status: entry.status,
    ...(entry.error ? { error: entry.error } : {}),
    ...(entry.meta ? { meta: entry.meta } : {}),
  }

  console.log(JSON.stringify(payload))
}
